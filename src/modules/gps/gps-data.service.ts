import { Injectable, OnModuleInit } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { GpsAuthService } from "./gps-auth.service";

export type GpsClient = { id: number; name: string; address: string; lat: number; lng: number };

export type GpsRepartidorStatus = { username: string; fullName: string | null; confirmed: boolean; pickCount: number };

export type GpsFinalRouteItem = { client: GpsClient; repartidorUsername: string; repartidorName: string | null };

export type GpsFinalRoute = { ready: boolean; status: GpsRepartidorStatus[]; items: GpsFinalRouteItem[] };

type ClientRow = RowDataPacket & { id: number; name: string; address: string; lat: number; lng: number };
type SelectionRow = RowDataPacket & { repartidor_username: string; client_ids_json: string };

// 20 clientes ficticios para la demo del proyecto -- no son datos reales de
// ningun cliente. Direcciones de Montevideo con coordenadas aproximadas,
// para que el mapa de rutas tenga puntos reales donde dibujar.
const DEMO_CLIENTS: Array<Omit<GpsClient, "id">> = [
  { name: "Panadería La Espiga", address: "Av. 18 de Julio 1234, Centro, Montevideo", lat: -34.9058, lng: -56.1913 },
  { name: "Almacén Don Pepe", address: "Bulevar Artigas 2500, Pocitos, Montevideo", lat: -34.9115, lng: -56.157 },
  { name: "Kiosco Rayitos", address: "Av. Italia 3400, Malvín, Montevideo", lat: -34.889, lng: -56.128 },
  { name: "Farmacia Sur", address: "Camino Maldonado 5600, Carrasco, Montevideo", lat: -34.88, lng: -56.062 },
  { name: "Mini Mercado Centro", address: "Av. 8 de Octubre 2800, Tres Cruces, Montevideo", lat: -34.895, lng: -56.165 },
  { name: "Verdulería Los Pinos", address: "Av. Rivera 4200, Buceo, Montevideo", lat: -34.907, lng: -56.139 },
  { name: "Carnicería El Novillo", address: "Av. Gral. Flores 3100, Aguada, Montevideo", lat: -34.899, lng: -56.185 },
  { name: "Panificadora Santa Fe", address: "Av. Agraciada 2600, La Comercial, Montevideo", lat: -34.893, lng: -56.192 },
  { name: "Autoservicio Belvedere", address: "Av. San Martín 2200, Belvedere, Montevideo", lat: -34.868, lng: -56.192 },
  { name: "Despensa La Esquina", address: "Camino Carrasco 1500, Punta Gorda, Montevideo", lat: -34.91, lng: -56.105 },
  { name: "Almacén El Progreso", address: "Av. Millán 3700, Peñarol, Montevideo", lat: -34.845, lng: -56.215 },
  { name: "Kiosco Central", address: "Bvar. España 2100, Parque Rodó, Montevideo", lat: -34.915, lng: -56.167 },
  { name: "Fiambrería Montevideo", address: "Av. Sarmiento 2050, Parque Batlle, Montevideo", lat: -34.898, lng: -56.155 },
  { name: "Panadería El Trigal", address: "Av. 8 de Octubre 4500, Cerrito, Montevideo", lat: -34.865, lng: -56.16 },
  { name: "Supermercado Familiar", address: "Av. Garzón 1800, Lezica, Montevideo", lat: -34.845, lng: -56.18 },
  { name: "Almacén Don Carlos", address: "Camino Castro 800, Colón, Montevideo", lat: -34.833, lng: -56.235 },
  { name: "Kiosco La Rambla", address: "Rambla Armenia 5500, Malvín Norte, Montevideo", lat: -34.88, lng: -56.122 },
  { name: "Verdulería Don Juan", address: "Av. Giannattasio Km 20, Ciudad de la Costa", lat: -34.795, lng: -55.975 },
  { name: "Despensa Rural", address: "Camino Melilla 4200, Melilla, Montevideo", lat: -34.79, lng: -56.3 },
  { name: "Mini Market 24hs", address: "Av. Bolivia 1400, Carrasco Norte, Montevideo", lat: -34.86, lng: -56.055 }
];

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

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly gpsAuthService: GpsAuthService
  ) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureDemoClients();
  }

  async listClients(): Promise<GpsClient[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<ClientRow[]>(`SELECT id, name, address, lat, lng FROM saas_gps_clients ORDER BY name ASC`);
    return rows.map((row) => ({ id: row.id, name: row.name, address: row.address, lat: Number(row.lat), lng: Number(row.lng) }));
  }

  async getMyPicks(username: string, dayLabel = todayDayLabel()): Promise<number[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<SelectionRow[]>(
      `SELECT client_ids_json FROM saas_gps_daily_selections WHERE day_label = ? AND repartidor_username = ? LIMIT 1`,
      [dayLabel, username]
    );
    return rows[0] ? parseClientIds(rows[0].client_ids_json) : [];
  }

  // Un repartidor solo puede confirmar una vez por dia -- si ya tiene fila
  // para ese dia, no la pisa (pedido explicito: "queda fija al confirmar").
  async submitPicks(username: string, clientIds: number[], dayLabel = todayDayLabel()): Promise<{ alreadyConfirmed: boolean }> {
    await this.ensureTables();
    const existing = await this.databaseService.query<RowDataPacket[]>(
      `SELECT 1 FROM saas_gps_daily_selections WHERE day_label = ? AND repartidor_username = ? LIMIT 1`,
      [dayLabel, username]
    );
    if (existing.length > 0) {
      return { alreadyConfirmed: true };
    }

    await this.databaseService.execute(
      `INSERT INTO saas_gps_daily_selections (day_label, repartidor_username, client_ids_json) VALUES (?, ?, ?)`,
      [dayLabel, username, JSON.stringify(clientIds)]
    );
    return { alreadyConfirmed: false };
  }

  async getStatus(dayLabel = todayDayLabel()): Promise<GpsRepartidorStatus[]> {
    await this.ensureTables();
    const repartidores = await this.gpsAuthService.listRepartidores();
    const rows = await this.databaseService.query<SelectionRow[]>(
      `SELECT repartidor_username, client_ids_json FROM saas_gps_daily_selections WHERE day_label = ?`,
      [dayLabel]
    );
    const byUsername = new Map(rows.map((row) => [row.repartidor_username, parseClientIds(row.client_ids_json)]));

    return repartidores.map((repartidor) => {
      const picks = byUsername.get(repartidor.username);
      return { username: repartidor.username, fullName: repartidor.fullName, confirmed: Boolean(picks), pickCount: picks?.length ?? 0 };
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

    const ready = status.length > 0 && status.every((entry) => entry.confirmed);
    if (!ready) {
      return { ready: false, status, items: [] };
    }

    const clientsById = new Map(clients.map((client) => [client.id, client]));
    const nameByUsername = new Map(status.map((entry) => [entry.username, entry.fullName]));

    const items: GpsFinalRouteItem[] = [];
    for (const row of rows) {
      const clientIds = parseClientIds(row.client_ids_json);
      for (const clientId of clientIds) {
        const client = clientsById.get(clientId);
        if (!client) continue;
        items.push({ client, repartidorUsername: row.repartidor_username, repartidorName: nameByUsername.get(row.repartidor_username) ?? null });
      }
    }

    return { ready: true, status, items };
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
         lng DECIMAL(10, 6) NOT NULL
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
  }

  // Siembra los clientes demo que falten -- idempotente por nombre, asi
  // cubre tanto la primera corrida (tabla vacia) como la migracion de 5 a
  // 20 clientes (14/11/2026) sin duplicar los que ya estaban.
  private async ensureDemoClients() {
    const existingRows = await this.databaseService.query<RowDataPacket[]>(`SELECT name FROM saas_gps_clients`);
    const existingNames = new Set(existingRows.map((row) => row.name));

    for (const client of DEMO_CLIENTS) {
      if (existingNames.has(client.name)) continue;
      await this.databaseService.execute(`INSERT INTO saas_gps_clients (name, address, lat, lng) VALUES (?, ?, ?, ?)`, [
        client.name,
        client.address,
        client.lat,
        client.lng
      ]);
    }
  }
}
