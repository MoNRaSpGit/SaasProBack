import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { GpsDataService } from "./gps-data.service";

// Ruta optima REAL (22/10/2026). Se usa OpenRouteService (gratis, sin
// tarjeta) en vez de Google: el usuario no podia cubrir la retencion de
// USD 50 que pide Google Cloud para verificar la tarjeta. Si mas adelante
// se pasa a Google, solo cambia este archivo.
// Direcciones NUEVAS (22/10/2026): api.openrouteservice.org quedo en desuso
// -- desde el 27/08/2026 da solo el 10% del cupo (50 optimizaciones / 200
// rutas por dia) y se apaga entre el 02 y el 06/11/2026. En api.heigit.org
// rige el cupo completo del plan (500 / 2000). Tabla oficial de migracion:
// ask.openrouteservice.org/t/7912.
const ORS_URLS = {
  optimization: "https://api.heigit.org/vroom/v0",
  directions: "https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson"
} as const;

// Punto de partida de todas las rutas. Mismo deposito ficticio que dibuja
// el frontend (RouteMapModal.tsx).
const DEPOT = { lat: -34.9011, lng: -56.1645 };

export type GpsOrsService = "optimization" | "directions";

// Limites del plan gratis de la clave (panel de OpenRouteService, 22/10/2026):
// son POR DIA. Los umbrales siguen la regla que pidio el usuario para
// Google (aviso a 5.000 y corte a 9.000 de 10.000 => 50% y 90%):
//  - alertAt: el admin ve el aviso en su panel; no se corta nada.
//  - cutAt: no se hace NINGUNA llamada mas en el dia; la app muestra el
//    cartel de "comunicarse con el proveedor".
const SERVICE_LIMITS: Record<GpsOrsService, { label: string; dailyLimit: number }> = {
  optimization: { label: "Optimización de rutas", dailyLimit: 500 },
  directions: { label: "Rutas por calles", dailyLimit: 2000 }
};
const ALERT_RATIO = 0.5;
const CUT_RATIO = 0.9;

// Telefono del proveedor (el usuario) para el cartel de corte.
export const GPS_PROVIDER_PHONE = "092 945 696";

export type GpsRouteResult = {
  orderedClientIds: number[];
  // [lat, lng] -- listo para dibujar con Leaflet.
  geometry: Array<[number, number]>;
  distanceKm: number;
  durationMin: number;
  fromCache: boolean;
};

export type GpsUsageEntry = {
  service: GpsOrsService;
  label: string;
  todayCalls: number;
  dailyLimit: number;
  alertAt: number;
  cutAt: number;
  monthCalls: number;
  status: "ok" | "alerta" | "cortado";
  // Lo que informa OpenRouteService en su ultima respuesta (por si su
  // conteo real difiere del nuestro).
  remoteRemaining: number | null;
  remoteLimit: number | null;
};

type UsageRow = RowDataPacket & { service: string; calls: number; remote_remaining: number | null; remote_limit: number | null };

function todayDayLabel() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Error que el frontend reconoce para mostrar el cartel grande.
export class GpsQuotaExceededException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: "GPS_QUOTA_EXCEEDED",
        message: `Se alcanzó el límite diario del servicio de rutas. Comunicarse con el proveedor: ${GPS_PROVIDER_PHONE}.`,
        providerPhone: GPS_PROVIDER_PHONE
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

@Injectable()
export class GpsRoutingService {
  private readonly logger = new Logger(GpsRoutingService.name);
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly gpsDataService: GpsDataService
  ) {}

  // Ruta optima para un conjunto de clientes: primero el ORDEN de visita
  // (optimization) y despues el recorrido por calles en ese orden
  // (directions). Las coordenadas salen de la base, no del pedido: la API
  // no sirve para calcular rutas a puntos cualquiera.
  async computeRoute(clientIds: number[]): Promise<GpsRouteResult> {
    await this.ensureTables();
    const uniqueIds = [...new Set(clientIds)];
    if (uniqueIds.length === 0) throw new BadRequestException("No hay clientes para armar la ruta.");

    const clients = (await this.gpsDataService.listClients()).filter((client) => uniqueIds.includes(client.id));
    if (clients.length !== uniqueIds.length) throw new BadRequestException("Hay clientes que no existen.");

    // Mismo conjunto de clientes = misma ruta: se reutiliza sin gastar
    // llamadas (abrir el mapa varias veces no consume nada).
    const cacheKey = createHash("sha1")
      .update(JSON.stringify({ depot: DEPOT, clients: clients.map((c) => [c.id, c.lat, c.lng]).sort((a, b) => Number(a[0]) - Number(b[0])) }))
      .digest("hex");
    const cached = await this.databaseService.query<Array<RowDataPacket & { result_json: unknown }>>(
      `SELECT result_json FROM saas_gps_route_cache WHERE cache_key = ? LIMIT 1`,
      [cacheKey]
    );
    if (cached[0]) {
      const result = typeof cached[0].result_json === "string" ? JSON.parse(cached[0].result_json) : cached[0].result_json;
      return { ...(result as GpsRouteResult), fromCache: true };
    }

    let orderedClientIds = clients.map((client) => client.id);
    if (clients.length > 1) {
      const optimization = await this.callOrs<{ routes?: Array<{ steps: Array<{ type: string; job?: number }> }> }>("optimization", {
        jobs: clients.map((client) => ({ id: client.id, location: [client.lng, client.lat] })),
        vehicles: [{ id: 1, profile: "driving-car", start: [DEPOT.lng, DEPOT.lat] }]
      });
      const steps = optimization.routes?.[0]?.steps ?? [];
      const ordered = steps.filter((step) => step.type === "job" && typeof step.job === "number").map((step) => step.job as number);
      // Si por algo no asigno a todos, los que falten van al final.
      orderedClientIds = [...ordered, ...orderedClientIds.filter((id) => !ordered.includes(id))];
    }

    const byId = new Map(clients.map((client) => [client.id, client]));
    const coordinates = [[DEPOT.lng, DEPOT.lat], ...orderedClientIds.map((id) => [byId.get(id)!.lng, byId.get(id)!.lat])];
    const directions = await this.callOrs<{
      features?: Array<{ geometry: { coordinates: Array<[number, number]> }; properties: { summary: { distance?: number; duration?: number } } }>;
    }>("directions", {
      coordinates,
      // -1 = sin radio maximo: cada punto se engancha a la calle mas cercana
      // aunque este lejos (por defecto son 350 m y un cliente con la
      // ubicacion un poco corrida, o en la costa, hacia fallar toda la ruta).
      radiuses: coordinates.map(() => -1)
    });

    const feature = directions.features?.[0];
    if (!feature) throw new ServiceUnavailableException("El servicio de rutas no devolvió un recorrido.");

    const result: GpsRouteResult = {
      orderedClientIds,
      geometry: feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: Math.round(((feature.properties.summary.distance ?? 0) / 1000) * 10) / 10,
      durationMin: Math.round((feature.properties.summary.duration ?? 0) / 60),
      fromCache: false
    };

    await this.databaseService.execute(
      `INSERT INTO saas_gps_route_cache (cache_key, result_json) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE result_json = VALUES(result_json), created_at = CURRENT_TIMESTAMP`,
      [cacheKey, JSON.stringify(result)]
    );
    return result;
  }

  // Para el panel del admin: cuanto se uso hoy y en el mes de cada servicio.
  async getUsage(): Promise<{ day: string; providerPhone: string; services: GpsUsageEntry[] }> {
    await this.ensureTables();
    const day = todayDayLabel();
    const [todayRows, monthRows] = await Promise.all([
      this.databaseService.query<UsageRow[]>(
        `SELECT service, calls, remote_remaining, remote_limit FROM saas_gps_api_usage WHERE day_label = ?`,
        [day]
      ),
      this.databaseService.query<UsageRow[]>(
        `SELECT service, SUM(calls) AS calls FROM saas_gps_api_usage WHERE day_label LIKE ? GROUP BY service`,
        [`${day.slice(0, 7)}-%`]
      )
    ]);

    const services = (Object.keys(SERVICE_LIMITS) as GpsOrsService[]).map((service) => {
      const today = todayRows.find((row) => row.service === service);
      const month = monthRows.find((row) => row.service === service);
      const { label, dailyLimit } = SERVICE_LIMITS[service];
      const alertAt = Math.floor(dailyLimit * ALERT_RATIO);
      const cutAt = Math.floor(dailyLimit * CUT_RATIO);
      const todayCalls = Number(today?.calls ?? 0);
      return {
        service,
        label,
        todayCalls,
        dailyLimit,
        alertAt,
        cutAt,
        monthCalls: Number(month?.calls ?? 0),
        status: todayCalls >= cutAt ? "cortado" : todayCalls >= alertAt ? "alerta" : "ok",
        remoteRemaining: today?.remote_remaining ?? null,
        remoteLimit: today?.remote_limit ?? null
      } satisfies GpsUsageEntry;
    });

    return { day, providerPhone: GPS_PROVIDER_PHONE, services };
  }

  // Cada llamada pasa por aca: chequea el corte ANTES de llamar, cuenta la
  // llamada y guarda lo que OpenRouteService dice que queda.
  private async callOrs<T>(service: GpsOrsService, body: unknown): Promise<T> {
    const apiKey = this.configService.get<string>("ORS_API_KEY");
    if (!apiKey) throw new ServiceUnavailableException("El servicio de rutas no está configurado (falta ORS_API_KEY).");

    const day = todayDayLabel();
    const cutAt = Math.floor(SERVICE_LIMITS[service].dailyLimit * CUT_RATIO);
    const rows = await this.databaseService.query<UsageRow[]>(
      `SELECT calls, remote_remaining, remote_limit FROM saas_gps_api_usage WHERE day_label = ? AND service = ? LIMIT 1`,
      [day, service]
    );
    const usage = rows[0];
    // Corte propio (90%) y, por las dudas, el conteo real del proveedor:
    // si a ellos les queda 10% o menos, tambien se corta.
    const remoteNearlyEmpty =
      usage?.remote_remaining !== null && usage?.remote_limit ? Number(usage.remote_remaining) <= Number(usage.remote_limit) * (1 - CUT_RATIO) : false;
    if (Number(usage?.calls ?? 0) >= cutAt || remoteNearlyEmpty) {
      throw new GpsQuotaExceededException();
    }

    await this.databaseService.execute(
      `INSERT INTO saas_gps_api_usage (day_label, service, calls) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE calls = calls + 1`,
      [day, service]
    );

    let response: Response;
    try {
      response = await fetch(ORS_URLS[service], {
        method: "POST",
        // La ruta por calles responde en GeoJSON: con "Accept: application/json" a
        // secas devuelve 406.
        headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json, application/geo+json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
      });
    } catch (error) {
      this.logger.warn(`OpenRouteService ${service} no respondio: ${(error as Error).message}`);
      throw new ServiceUnavailableException("El servicio de rutas no respondió. Probá de nuevo en un rato.");
    }

    const remoteRemaining = Number(response.headers.get("x-ratelimit-remaining"));
    const remoteLimit = Number(response.headers.get("x-ratelimit-limit"));
    if (Number.isFinite(remoteRemaining) && Number.isFinite(remoteLimit) && remoteLimit > 0) {
      await this.databaseService.execute(
        `UPDATE saas_gps_api_usage SET remote_remaining = ?, remote_limit = ? WHERE day_label = ? AND service = ?`,
        [remoteRemaining, remoteLimit, day, service]
      );
    }

    // 429 = demasiadas por minuto; 403 con "quota" = se acabo el cupo del
    // dia (FAQ de openrouteservice). En los dos casos: cartel de limite. Un
    // 403 sin "quota" es otra cosa (ej. clave invalida) y va como error comun.
    if (response.status === 429) throw new GpsQuotaExceededException();
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      if (response.status === 403 && /quota/i.test(text)) throw new GpsQuotaExceededException();
      this.logger.warn(`OpenRouteService ${service} respondio ${response.status}: ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException("El servicio de rutas no pudo calcular el recorrido.");
    }
    return (await response.json()) as T;
  }

  private async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables().catch((error) => {
        this.ensureTablesPromise = null;
        throw error;
      });
    }
    await this.ensureTablesPromise;
  }

  // Mismo patron que gps-data.service.ts: las tablas del modulo se crean
  // solas al arrancar.
  private async createTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_api_usage (
         day_label VARCHAR(10) NOT NULL,
         service VARCHAR(30) NOT NULL,
         calls INT NOT NULL DEFAULT 0,
         remote_remaining INT NULL,
         remote_limit INT NULL,
         updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (day_label, service)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_route_cache (
         cache_key CHAR(40) NOT NULL PRIMARY KEY,
         result_json JSON NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}
