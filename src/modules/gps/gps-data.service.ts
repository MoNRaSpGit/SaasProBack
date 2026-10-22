import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

export type GpsClient = { id: number; name: string; address: string; lat: number; lng: number };

export type GpsPersona = { key: string; fullName: string };

export type GpsRepartidorStatus = { username: string; fullName: string | null; confirmed: boolean; pickCount: number };

export type GpsFinalRouteItem = { client: GpsClient; repartidorUsername: string; repartidorName: string | null };

export type GpsFinalRoute = { ready: boolean; status: GpsRepartidorStatus[]; items: GpsFinalRouteItem[] };

type ClientRow = RowDataPacket & { id: number; name: string; address: string; lat: number; lng: number; assigned_username: string | null };
type SelectionRow = RowDataPacket & { repartidor_username: string; client_ids_json: string };

// Pedido explicito (20/10/2026): ya no hay una cuenta de login por
// persona -- el login es un solo rol generico "repartidor" (ver
// gps-auth.service.ts) y adentro se elige una de estas 4 pestañas. Si el
// dia de mañana hay un 5to repartidor, se agrega aca nomas.
export const PERSONAS: GpsPersona[] = [
  { key: "martin", fullName: "Martín" },
  { key: "ana", fullName: "Ana" },
  { key: "juan", fullName: "Juan" },
  { key: "pedro", fullName: "Pedro" }
];

const PERSONA_KEYS = new Set(PERSONAS.map((persona) => persona.key));

// 20 clientes ficticios para la demo del proyecto -- no son datos reales de
// ningun cliente. Direcciones de Montevideo con coordenadas aproximadas,
// para que el mapa de rutas tenga puntos reales donde dibujar. Cada
// cliente es fijo de UNA pestaña (persona), nunca se superponen.
const DEMO_CLIENTS: Array<Omit<GpsClient, "id"> & { assignedUsername: string }> = [
  { name: "Panadería La Espiga", address: "Av. 18 de Julio 1234, Centro, Montevideo", lat: -34.9058, lng: -56.1913, assignedUsername: "martin" },
  { name: "Almacén Don Pepe", address: "Bulevar Artigas 2500, Pocitos, Montevideo", lat: -34.9115, lng: -56.157, assignedUsername: "martin" },
  { name: "Kiosco Rayitos", address: "Av. Italia 3400, Malvín, Montevideo", lat: -34.889, lng: -56.128, assignedUsername: "martin" },
  { name: "Farmacia Sur", address: "Camino Maldonado 5600, Carrasco, Montevideo", lat: -34.88, lng: -56.062, assignedUsername: "martin" },
  { name: "Mini Mercado Centro", address: "Av. 8 de Octubre 2800, Tres Cruces, Montevideo", lat: -34.895, lng: -56.165, assignedUsername: "martin" },
  { name: "Verdulería Los Pinos", address: "Av. Rivera 4200, Buceo, Montevideo", lat: -34.907, lng: -56.139, assignedUsername: "ana" },
  { name: "Carnicería El Novillo", address: "Av. Gral. Flores 3100, Aguada, Montevideo", lat: -34.899, lng: -56.185, assignedUsername: "ana" },
  { name: "Panificadora Santa Fe", address: "Av. Agraciada 2600, La Comercial, Montevideo", lat: -34.893, lng: -56.192, assignedUsername: "ana" },
  { name: "Autoservicio Belvedere", address: "Av. San Martín 2200, Belvedere, Montevideo", lat: -34.868, lng: -56.192, assignedUsername: "ana" },
  { name: "Despensa La Esquina", address: "Camino Carrasco 1500, Punta Gorda, Montevideo", lat: -34.91, lng: -56.105, assignedUsername: "ana" },
  { name: "Almacén El Progreso", address: "Av. Millán 3700, Peñarol, Montevideo", lat: -34.845, lng: -56.215, assignedUsername: "juan" },
  { name: "Kiosco Central", address: "Bvar. España 2100, Parque Rodó, Montevideo", lat: -34.915, lng: -56.167, assignedUsername: "juan" },
  { name: "Fiambrería Montevideo", address: "Av. Sarmiento 2050, Parque Batlle, Montevideo", lat: -34.898, lng: -56.155, assignedUsername: "juan" },
  { name: "Panadería El Trigal", address: "Av. 8 de Octubre 4500, Cerrito, Montevideo", lat: -34.865, lng: -56.16, assignedUsername: "juan" },
  { name: "Supermercado Familiar", address: "Av. Garzón 1800, Lezica, Montevideo", lat: -34.845, lng: -56.18, assignedUsername: "juan" },
  { name: "Almacén Don Carlos", address: "Camino Castro 800, Colón, Montevideo", lat: -34.833, lng: -56.235, assignedUsername: "pedro" },
  { name: "Kiosco La Rambla", address: "Rambla Armenia 5500, Malvín Norte, Montevideo", lat: -34.88, lng: -56.122, assignedUsername: "pedro" },
  { name: "Verdulería Don Juan", address: "Av. Giannattasio Km 20, Ciudad de la Costa", lat: -34.795, lng: -55.975, assignedUsername: "pedro" },
  { name: "Despensa Rural", address: "Camino Melilla 4200, Melilla, Montevideo", lat: -34.79, lng: -56.3, assignedUsername: "pedro" },
  { name: "Mini Market 24hs", address: "Av. Bolivia 1400, Carrasco Norte, Montevideo", lat: -34.86, lng: -56.055, assignedUsername: "pedro" }
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

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureDemoClients();
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

    // Migracion (14/11/2026): la tabla ya existia sin assigned_username --
    // mismo patron de chequeo que scrum.service.ts.
    const assignedColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'saas_gps_clients' AND column_name = 'assigned_username'`
    );
    if (Number(assignedColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(`ALTER TABLE saas_gps_clients ADD COLUMN assigned_username VARCHAR(60) NULL`);
    }
  }

  // Siembra los clientes demo que falten y corrige el dueño (assigned_username)
  // de los que ya existian -- idempotente por nombre, asi cubre la primera
  // corrida, la migracion de 5 a 20 clientes, y ahora el paso de 3 a 4
  // pestañas (20/10/2026, se reparten 5/5/5/5 en vez de 7/7/6).
  private async ensureDemoClients() {
    const existingRows = await this.databaseService.query<RowDataPacket[]>(`SELECT id, name, assigned_username FROM saas_gps_clients`);
    const existingByName = new Map(existingRows.map((row) => [row.name, row]));

    for (const client of DEMO_CLIENTS) {
      const existing = existingByName.get(client.name);
      if (!existing) {
        await this.databaseService.execute(`INSERT INTO saas_gps_clients (name, address, lat, lng, assigned_username) VALUES (?, ?, ?, ?, ?)`, [
          client.name,
          client.address,
          client.lat,
          client.lng,
          client.assignedUsername
        ]);
      } else if (existing.assigned_username !== client.assignedUsername) {
        await this.databaseService.execute(`UPDATE saas_gps_clients SET assigned_username = ? WHERE id = ?`, [
          client.assignedUsername,
          existing.id
        ]);
      }
    }
  }
}
