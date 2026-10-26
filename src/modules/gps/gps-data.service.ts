import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

export type GpsClient = { id: number; name: string; address: string; lat: number; lng: number };

export type GpsPersona = { key: string; fullName: string };

export type GpsRepartidorStatus = { username: string; fullName: string | null; confirmed: boolean; pickCount: number };

export type GpsFinalRouteItem = { client: GpsClient; repartidorUsername: string; repartidorName: string | null };

export type GpsFinalRoute = { ready: boolean; status: GpsRepartidorStatus[]; items: GpsFinalRouteItem[] };

// Ruta final ya generada (foto): queda guardada aunque se reinicien las
// rutas, para poder volver a verla.
export type GpsGeneratedFinalRoute = {
  id: number;
  dayLabel: string;
  createdAt: string;
  items: GpsFinalRouteItem[];
  // Quienes no habian guardado su ruta cuando se genero.
  missing: string[];
  // Orden de visita elegido a mano (null = el optimo que calcula el servicio).
  customOrder: number[] | null;
};

type GeneratedRow = RowDataPacket & {
  id: number;
  day_label: string;
  items_json: unknown;
  missing_json: unknown;
  order_json: unknown;
  created_at: string;
};

type ClientRow = RowDataPacket & {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  assigned_username: string | null;
  geo_quality: string | null;
};

// Para la pestaña "Clientes": a quien pertenece cada uno y que tan precisa
// es su ubicacion (puerta / esquina / calle = aproximada).
export type GpsClientAssignment = {
  id: number;
  name: string;
  address: string;
  assignedUsername: string | null;
  geoQuality: string | null;
};
type SelectionRow = RowDataPacket & { repartidor_username: string; client_ids_json: string };

// Pedido explicito (20/10/2026): ya no hay una cuenta de login por
// persona -- el login es un solo rol generico "repartidor" (ver
// gps-auth.service.ts) y adentro se elige una de estas 4 pestañas. Si el
// dia de mañana hay un 5to repartidor, se agrega aca nomas.
//
// Nombres reales (27/10/2026, pedido explicito): Matias, Andres, Edinson y
// Rodrigo reemplazan a los de prueba. Las claves (martin/ana/juan/pedro)
// NO se cambian: con ellas estan guardados los clientes asignados y las
// selecciones de cada repartidor; son solo internas.
export const PERSONAS: GpsPersona[] = [
  { key: "martin", fullName: "Matías" },
  { key: "ana", fullName: "Andrés" },
  { key: "juan", fullName: "Edinson" },
  { key: "pedro", fullName: "Rodrigo" }
];

const PERSONA_KEYS = new Set(PERSONAS.map((persona) => persona.key));

// Clientes REALES (22/10/2026): se cargaron desde el listado del cliente
// (importacion unica desde el listado PDF). Ya no se siembran clientes demo.
// Cada cliente es de UNA pestaña (assigned_username) o queda sin asignar
// (NULL) hasta que se lo asignen en la pestaña "Clientes".

// mysql2 ya deserializa las columnas JSON a objetos/arrays cuando puede --
// JSON.parse directo revienta en ese caso (mismo bug visto en el modulo
// movimientos con items_json).
function parseClientIds(raw: unknown): number[] {
  return typeof raw === "string" ? JSON.parse(raw) : (raw as number[]);
}

function todayDayLabel() {
  const montevideoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  return `${montevideoNow.getFullYear()}-${String(montevideoNow.getMonth() + 1).padStart(2, "0")}-${String(
    montevideoNow.getDate()
  ).padStart(2, "0")}`;
}

@Injectable()
export class GpsDataService implements OnModuleInit {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  listPersonas(): GpsPersona[] {
    return PERSONAS;
  }

  // Sin personaKey: todos los clientes (uso del admin). Con personaKey:
  // solo los clientes fijos de esa pestaña (nunca se superponen entre
  // personas).
  async listClients(personaKey?: string): Promise<GpsClient[]> {
    await this.ensureTables();
    if (personaKey) this.requireValidPersona(personaKey);
    const rows = personaKey
      ? await this.databaseService.query<ClientRow[]>(
          `SELECT id, name, address, lat, lng, assigned_username FROM saas_gps_clients WHERE assigned_username = ? ORDER BY name ASC`,
          [personaKey]
        )
      : await this.databaseService.query<ClientRow[]>(
          `SELECT id, name, address, lat, lng, assigned_username FROM saas_gps_clients ORDER BY name ASC`
        );
    return rows.map((row) => ({ id: row.id, name: row.name, address: row.address, lat: Number(row.lat), lng: Number(row.lng) }));
  }

  async listAssignments(): Promise<GpsClientAssignment[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<ClientRow[]>(
      `SELECT id, name, address, assigned_username, geo_quality FROM saas_gps_clients ORDER BY name ASC`
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      assignedUsername: row.assigned_username,
      geoQuality: row.geo_quality
    }));
  }

  // Pestaña "Clientes" (22/10/2026, pedido explicito): se elige un
  // repartidor y se le van dando clientes; persona null = devolverlos a
  // "sin asignar".
  // Cliente cargado a mano (27/10/2026): queda sin asignar, como los
  // importados; despues un repartidor lo toma desde la pestaña Clientes.
  async createClient(input: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    geoQuality: "puerta" | "esquina" | "calle";
  }): Promise<GpsClientAssignment> {
    await this.ensureTables();
    const name = input.name.trim();
    const address = input.address.trim();
    const duplicate = await this.databaseService.query<RowDataPacket[]>(
      `SELECT id FROM saas_gps_clients WHERE LOWER(name) = LOWER(?) AND LOWER(address) = LOWER(?) LIMIT 1`,
      [name, address]
    );
    if (duplicate.length > 0) throw new BadRequestException("Ya existe un cliente con ese nombre y esa dirección.");
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gps_clients (name, address, lat, lng, assigned_username, geo_quality) VALUES (?, ?, ?, ?, NULL, ?)`,
      [name, address, input.lat, input.lng, input.geoQuality]
    );
    return { id: result.insertId, name, address, assignedUsername: null, geoQuality: input.geoQuality };
  }

  async assignClients(clientIds: number[], personaKey: string | null): Promise<{ updated: number }> {
    await this.ensureTables();
    if (personaKey !== null) this.requireValidPersona(personaKey);
    const uniqueIds = [...new Set(clientIds)];
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_gps_clients SET assigned_username = ? WHERE id IN (${uniqueIds.map(() => "?").join(", ")})`,
      [personaKey, ...uniqueIds]
    );
    return { updated: result.affectedRows };
  }

  async getMyPicks(personaKey: string, dayLabel = todayDayLabel()): Promise<number[]> {
    await this.ensureTables();
    this.requireValidPersona(personaKey);
    const rows = await this.databaseService.query<SelectionRow[]>(
      `SELECT client_ids_json FROM saas_gps_daily_selections WHERE day_label = ? AND repartidor_username = ? LIMIT 1`,
      [dayLabel, personaKey]
    );
    return rows[0] ? parseClientIds(rows[0].client_ids_json) : [];
  }

  // Una pestaña solo puede confirmar una vez por dia -- si se equivocó,
  // tiene que llamar a resetPicks primero (pedido explicito 14/11/2026:
  // "poné algo para poder editar la ruta").
  async submitPicks(personaKey: string, clientIds: number[], dayLabel = todayDayLabel()): Promise<{ alreadyConfirmed: boolean }> {
    await this.ensureTables();
    this.requireValidPersona(personaKey);

    const ownClients = await this.listClients(personaKey);
    const ownClientIds = new Set(ownClients.map((client) => client.id));
    if (clientIds.some((id) => !ownClientIds.has(id))) {
      throw new BadRequestException("Hay clientes que no le pertenecen a esta pestaña.");
    }

    const existing = await this.databaseService.query<RowDataPacket[]>(
      `SELECT 1 FROM saas_gps_daily_selections WHERE day_label = ? AND repartidor_username = ? LIMIT 1`,
      [dayLabel, personaKey]
    );
    if (existing.length > 0) {
      return { alreadyConfirmed: true };
    }

    await this.databaseService.execute(
      `INSERT INTO saas_gps_daily_selections (day_label, repartidor_username, client_ids_json) VALUES (?, ?, ?)`,
      [dayLabel, personaKey, JSON.stringify(clientIds)]
    );
    return { alreadyConfirmed: false };
  }

  // Deshace la confirmación del día para poder volver a tildar y generar
  // de nuevo -- no borra los clientes elegidos de la pantalla, solo
  // destraba la edición en el backend.
  async resetPicks(personaKey: string, dayLabel = todayDayLabel()): Promise<void> {
    await this.ensureTables();
    this.requireValidPersona(personaKey);
    await this.databaseService.execute(`DELETE FROM saas_gps_daily_selections WHERE day_label = ? AND repartidor_username = ?`, [
      dayLabel,
      personaKey
    ]);
  }

  // Reinicia la seleccion de las 4 pestañas de una (pedido explicito:
  // boton "Reiniciar rutas"), por si hay que volver a arrancar el dia sin
  // tener que destrabar cada pestaña por separado.
  async resetAllPicks(dayLabel = todayDayLabel()): Promise<void> {
    await this.ensureTables();
    await this.databaseService.execute(`DELETE FROM saas_gps_daily_selections WHERE day_label = ?`, [dayLabel]);
  }

  async getStatus(dayLabel = todayDayLabel()): Promise<GpsRepartidorStatus[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<SelectionRow[]>(
      `SELECT repartidor_username, client_ids_json FROM saas_gps_daily_selections WHERE day_label = ?`,
      [dayLabel]
    );
    const byPersona = new Map(rows.map((row) => [row.repartidor_username, parseClientIds(row.client_ids_json)]));

    return PERSONAS.map((persona) => {
      const picks = byPersona.get(persona.key);
      return { username: persona.key, fullName: persona.fullName, confirmed: Boolean(picks), pickCount: picks?.length ?? 0 };
    });
  }

  async getFinalRoute(dayLabel = todayDayLabel()): Promise<GpsFinalRoute> {
    await this.ensureTables();
    const [status, clients, rows] = await Promise.all([
      this.getStatus(dayLabel),
      this.listClients(),
      this.databaseService.query<SelectionRow[]>(
        `SELECT repartidor_username, client_ids_json FROM saas_gps_daily_selections WHERE day_label = ?`,
        [dayLabel]
      )
    ]);

    // ready = las 4 guardaron. Desde 22/10/2026 (pedido explicito) la ruta
    // final se puede armar igual con las que ya guardaron: los items traen
    // siempre lo confirmado hasta ahora, y es el frontend el que pregunta
    // "faltan X e Y, ¿generar igual?".
    const ready = status.length > 0 && status.every((entry) => entry.confirmed);

    const clientsById = new Map(clients.map((client) => [client.id, client]));
    const nameByPersona = new Map(status.map((entry) => [entry.username, entry.fullName]));

    const items: GpsFinalRouteItem[] = [];
    for (const row of rows) {
      const clientIds = parseClientIds(row.client_ids_json);
      for (const clientId of clientIds) {
        const client = clientsById.get(clientId);
        if (!client) continue;
        items.push({ client, repartidorUsername: row.repartidor_username, repartidorName: nameByPersona.get(row.repartidor_username) ?? null });
      }
    }

    return { ready, status, items };
  }

  // Genera la ruta final (22/10/2026, pedido explicito): guarda la foto de
  // lo que habia guardado cada repartidor y despues reinicia las rutas de
  // todos, para que el siguiente reparto arranque de cero. La ruta
  // generada se puede seguir viendo con getLastGeneratedFinalRoute.
  async generateFinalRoute(dayLabel = todayDayLabel()): Promise<GpsGeneratedFinalRoute> {
    await this.ensureTables();
    const current = await this.getFinalRoute(dayLabel);
    if (current.items.length === 0) {
      throw new BadRequestException("Todavía nadie guardó su ruta.");
    }
    const missing = current.status.filter((entry) => !entry.confirmed).map((entry) => entry.fullName ?? entry.username);

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gps_final_routes (day_label, items_json, missing_json) VALUES (?, ?, ?)`,
      [dayLabel, JSON.stringify(current.items), JSON.stringify(missing)]
    );
    await this.resetAllPicks(dayLabel);

    const generated = await this.getGeneratedFinalRoute(result.insertId);
    return generated!;
  }

  async getLastGeneratedFinalRoute(): Promise<GpsGeneratedFinalRoute | null> {
    await this.ensureTables();
    const rows = await this.databaseService.query<GeneratedRow[]>(
      `SELECT id, day_label, items_json, missing_json, order_json, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
       FROM saas_gps_final_routes ORDER BY id DESC LIMIT 1`
    );
    return rows[0] ? this.mapGenerated(rows[0]) : null;
  }

  // Guarda el orden elegido a mano: tienen que ser exactamente los mismos
  // clientes de la ruta, solo cambiados de lugar.
  async saveFinalRouteOrder(id: number, clientIds: number[]): Promise<GpsGeneratedFinalRoute> {
    await this.ensureTables();
    const route = await this.getGeneratedFinalRoute(id);
    if (!route) throw new BadRequestException("Esa ruta final ya no existe.");
    const routeIds = route.items.map((item) => item.client.id).sort((a, b) => a - b);
    const givenIds = [...clientIds].sort((a, b) => a - b);
    if (routeIds.length !== givenIds.length || routeIds.some((value, index) => value !== givenIds[index])) {
      throw new BadRequestException("El orden no coincide con los clientes de la ruta.");
    }
    await this.databaseService.execute(`UPDATE saas_gps_final_routes SET order_json = ? WHERE id = ?`, [JSON.stringify(clientIds), id]);
    return (await this.getGeneratedFinalRoute(id))!;
  }

  private async getGeneratedFinalRoute(id: number): Promise<GpsGeneratedFinalRoute | null> {
    const rows = await this.databaseService.query<GeneratedRow[]>(
      `SELECT id, day_label, items_json, missing_json, order_json, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
       FROM saas_gps_final_routes WHERE id = ?`,
      [id]
    );
    return rows[0] ? this.mapGenerated(rows[0]) : null;
  }

  private mapGenerated(row: GeneratedRow): GpsGeneratedFinalRoute {
    const parse = <T>(raw: unknown): T => (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
    return {
      id: row.id,
      dayLabel: row.day_label,
      createdAt: row.created_at,
      items: parse<GpsFinalRouteItem[]>(row.items_json),
      missing: parse<string[]>(row.missing_json),
      customOrder: row.order_json === null || row.order_json === undefined ? null : parse<number[]>(row.order_json)
    };
  }

  private requireValidPersona(personaKey: string) {
    if (!PERSONA_KEYS.has(personaKey)) {
      throw new BadRequestException("Pestaña inválida.");
    }
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

  private async createTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_clients (
         id INT AUTO_INCREMENT PRIMARY KEY,
         name VARCHAR(120) NOT NULL,
         address VARCHAR(200) NOT NULL,
         lat DECIMAL(10, 6) NOT NULL,
         lng DECIMAL(10, 6) NOT NULL,
         assigned_username VARCHAR(60) NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_daily_selections (
         day_label VARCHAR(10) NOT NULL,
         repartidor_username VARCHAR(60) NOT NULL,
         client_ids_json JSON NOT NULL,
         confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (day_label, repartidor_username)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    // Rutas finales ya generadas (22/10/2026): la seleccion de cada
    // repartidor se reinicia al generar, asi que la ruta queda guardada aca.
    // created_at en UTC (se lee con DATE_FORMAT + "Z").
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_final_routes (
         id INT AUTO_INCREMENT PRIMARY KEY,
         day_label VARCHAR(10) NOT NULL,
         items_json JSON NOT NULL,
         missing_json JSON NOT NULL,
         created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    // Migracion (14/11/2026): la tabla ya existia sin assigned_username --
    // mismo patron de chequeo que scrum.service.ts.
    const assignedColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'saas_gps_clients' AND column_name = 'assigned_username'`
    );
    if (Number(assignedColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(`ALTER TABLE saas_gps_clients ADD COLUMN assigned_username VARCHAR(60) NULL`);
    }

    // Migracion (22/10/2026): precision de la ubicacion de cada cliente
    // real (puerta / esquina / calle).
    const geoColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'saas_gps_clients' AND column_name = 'geo_quality'`
    );
    if (Number(geoColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(`ALTER TABLE saas_gps_clients ADD COLUMN geo_quality VARCHAR(10) NULL`);
    }

    // Migracion (23/10/2026): orden de visita editado a mano.
    const orderColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'saas_gps_final_routes' AND column_name = 'order_json'`
    );
    if (Number(orderColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(`ALTER TABLE saas_gps_final_routes ADD COLUMN order_json JSON NULL`);
    }
  }
}
