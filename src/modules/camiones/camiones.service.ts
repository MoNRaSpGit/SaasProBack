import { BadRequestException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CamionesRequestUser } from "./camiones.types";
import { CreateCamionesClientDto } from "./dto/create-camiones-client.dto";
import { CreateCamionesPlaceDto } from "./dto/create-camiones-place.dto";
import { CreateCamionesTripDto } from "./dto/create-camiones-trip.dto";
import { ListCamionesClientsDto } from "./dto/list-camiones-clients.dto";
import { ListCamionesPlacesDto } from "./dto/list-camiones-places.dto";
import { ListCamionesTripsDto } from "./dto/list-camiones-trips.dto";
import { UpdateCamionesClientDto } from "./dto/update-camiones-client.dto";
import { UpdateCamionesPlaceDto } from "./dto/update-camiones-place.dto";
import { SubmitCamionesTripDto } from "./dto/submit-camiones-trip.dto";
import { UpdateCamionesTripDto } from "./dto/update-camiones-trip.dto";

type CamionesClientRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

// Porcentaje del camionero sobre lo facturado del viaje (pedido 06/11/2026).
const DRIVER_PERCENT = 10;

type CamionesTripRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  client_id: number;
  place_id: number | null;
  user_id: number;
  trip_date: string;
  place: string;
  truck: "mercedes" | "volkswagen" | null;
  kilometers: string;
  status: "confirmed" | "pending" | "paid" | "cancelled";
  collected_amount: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  place_name?: string;
  created_by_name?: string | null;
  created_by_is_driver?: number | null;
  driver_paid_at?: string | null;
  driver_done_at?: string | null;
};

type CamionesPlaceRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  name: string;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class CamionesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private normalizeEntityName(value: string) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }

  private async findActiveClientByNormalizedName(tenantId: number, name: string) {
    const rows = await this.databaseService.query<CamionesClientRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         phone,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_clients
       WHERE tenant_id = ?
         AND is_active = 1`,
      [tenantId]
    );

    const normalizedName = this.normalizeEntityName(name);
    return rows.find((row) => this.normalizeEntityName(row.name) === normalizedName);
  }

  async listClients(currentUser: CamionesRequestUser, query: ListCamionesClientsDto) {
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const whereParts = ["tenant_id = ?", "is_active = 1"];
    const values: Array<string | number> = [currentUser.tenantId];

    if (search) {
      whereParts.push("(name LIKE ? OR phone LIKE ?)");
      const likeValue = `%${search}%`;
      values.push(likeValue, likeValue);
    }

    values.push(limit);

    const rows = await this.databaseService.query<CamionesClientRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         phone,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_clients
       WHERE ${whereParts.join(" AND ")}
       ORDER BY name ASC
       LIMIT ?`,
      values
    );

    return {
      items: rows.map((row) => this.mapClient(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length,
        limit
      }
    };
  }

  async createClient(currentUser: CamionesRequestUser, dto: CreateCamionesClientDto) {
    const name = dto.name.trim().replace(/\s+/g, " ");
    const phone = dto.phone?.trim() || null;
    const notes = dto.notes?.trim() || null;

    const existingClient = await this.findActiveClientByNormalizedName(currentUser.tenantId, name);

    if (existingClient) {
      const nextPhone = phone ?? existingClient.phone;
      const nextNotes = notes ?? existingClient.notes;

      if (existingClient.phone !== nextPhone || existingClient.notes !== nextNotes) {
        await this.databaseService.execute<ResultSetHeader>(
          `UPDATE saas_camiones_clients
           SET phone = ?,
               notes = ?
           WHERE id = ?
             AND tenant_id = ?`,
          [nextPhone, nextNotes, existingClient.id, currentUser.tenantId]
        );

        const refreshedRows = await this.databaseService.query<CamionesClientRow[]>(
          `SELECT
             id,
             tenant_id,
             branch_id,
             name,
             phone,
             notes,
             is_active,
             created_at,
             updated_at
           FROM saas_camiones_clients
           WHERE id = ?
             AND tenant_id = ?
           LIMIT 1`,
          [existingClient.id, currentUser.tenantId]
        );

        return { item: this.mapClient(refreshedRows[0]) };
      }

      return { item: this.mapClient(existingClient) };
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_camiones_clients (
         tenant_id,
         branch_id,
         name,
         phone,
         notes,
         is_active
       )
       VALUES (?, NULL, ?, ?, ?, 1)`,
      [currentUser.tenantId, name, phone, notes]
    );

    const rows = await this.databaseService.query<CamionesClientRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         phone,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_clients
       WHERE id = ?
         AND tenant_id = ?
       LIMIT 1`,
      [result.insertId, currentUser.tenantId]
    );

    return {
      item: this.mapClient(rows[0])
    };
  }

  async updateClient(currentUser: CamionesRequestUser, clientId: number, dto: UpdateCamionesClientDto) {
    const name = dto.name.trim().replace(/\s+/g, " ");
    const phone = dto.phone?.trim() || null;
    const notes = dto.notes?.trim() || null;

    const duplicateClient = await this.findActiveClientByNormalizedName(currentUser.tenantId, name);

    if (duplicateClient && duplicateClient.id !== clientId) {
      throw new BadRequestException("Ya existe otro cliente con ese nombre");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_clients
       SET name = ?,
           phone = ?,
           notes = ?
       WHERE id = ?
         AND tenant_id = ?
         AND is_active = 1`,
      [name, phone, notes, clientId, currentUser.tenantId]
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Cliente no encontrado para este tenant");
    }

    const rows = await this.databaseService.query<CamionesClientRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         phone,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_clients
       WHERE id = ?
         AND tenant_id = ?
       LIMIT 1`,
      [clientId, currentUser.tenantId]
    );

    return {
      item: this.mapClient(rows[0])
    };
  }

  async archiveClient(currentUser: CamionesRequestUser, clientId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_clients
       SET is_active = 0
       WHERE id = ?
         AND tenant_id = ?
         AND is_active = 1`,
      [clientId, currentUser.tenantId]
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Cliente activo no encontrado para este tenant");
    }

    return { ok: true };
  }

  async listPlaces(currentUser: CamionesRequestUser, query: ListCamionesPlacesDto) {
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const whereParts = ["tenant_id = ?", "is_active = 1"];
    const values: Array<string | number> = [currentUser.tenantId];

    if (search) {
      whereParts.push("name LIKE ?");
      values.push(`%${search}%`);
    }

    values.push(limit);

    const rows = await this.databaseService.query<CamionesPlaceRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_places
       WHERE ${whereParts.join(" AND ")}
       ORDER BY name ASC
       LIMIT ?`,
      values
    );

    return {
      items: rows.map((row) => this.mapPlace(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length,
        limit
      }
    };
  }

  async createPlace(currentUser: CamionesRequestUser, dto: CreateCamionesPlaceDto) {
    const name = dto.name.trim();
    const notes = dto.notes?.trim() || null;

    const existingRows = await this.databaseService.query<CamionesPlaceRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_places
       WHERE tenant_id = ?
         AND LOWER(name) = LOWER(?)
       LIMIT 1`,
      [currentUser.tenantId, name]
    );

    if (existingRows[0]) {
      return { item: this.mapPlace(existingRows[0]) };
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_camiones_places (
         tenant_id,
         branch_id,
         name,
         notes,
         is_active
       )
       VALUES (?, NULL, ?, ?, 1)`,
      [currentUser.tenantId, name, notes]
    );

    const rows = await this.databaseService.query<CamionesPlaceRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_places
       WHERE id = ?
         AND tenant_id = ?
       LIMIT 1`,
      [result.insertId, currentUser.tenantId]
    );

    return {
      item: this.mapPlace(rows[0])
    };
  }

  async updatePlace(currentUser: CamionesRequestUser, placeId: number, dto: UpdateCamionesPlaceDto) {
    const name = dto.name.trim();
    const notes = dto.notes?.trim() || null;

    const duplicateRows = await this.databaseService.query<CamionesPlaceRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_places
       WHERE tenant_id = ?
         AND LOWER(name) = LOWER(?)
         AND id <> ?
       LIMIT 1`,
      [currentUser.tenantId, name, placeId]
    );

    if (duplicateRows[0]) {
      throw new BadRequestException("Ya existe otro lugar con ese nombre");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_places
       SET name = ?,
           notes = ?
       WHERE id = ?
         AND tenant_id = ?
         AND is_active = 1`,
      [name, notes, placeId, currentUser.tenantId]
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Lugar no encontrado para este tenant");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_trips
       SET place = ?
       WHERE place_id = ?
         AND tenant_id = ?`,
      [name, placeId, currentUser.tenantId]
    );

    const rows = await this.databaseService.query<CamionesPlaceRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_places
       WHERE id = ?
         AND tenant_id = ?
       LIMIT 1`,
      [placeId, currentUser.tenantId]
    );

    return {
      item: this.mapPlace(rows[0])
    };
  }

  async archivePlace(currentUser: CamionesRequestUser, placeId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_places
       SET is_active = 0
       WHERE id = ?
         AND tenant_id = ?
         AND is_active = 1`,
      [placeId, currentUser.tenantId]
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Lugar activo no encontrado para este tenant");
    }

    return { ok: true };
  }

  async listTrips(currentUser: CamionesRequestUser, query: ListCamionesTripsDto) {
    const limit = query.limit ?? 50;
    const whereParts = ["t.tenant_id = ?"];
    const values: Array<string | number> = [currentUser.tenantId];

    if (query.clientId) {
      whereParts.push("t.client_id = ?");
      values.push(query.clientId);
    }

    if (query.status) {
      whereParts.push("t.status = ?");
      values.push(query.status);
    }

    values.push(limit);

    const rows = await this.databaseService.query<CamionesTripRow[]>(
      `SELECT
         t.id,
         t.tenant_id,
         t.branch_id,
         t.client_id,
         t.place_id,
         t.user_id,
         t.trip_date,
         t.place,
         t.truck,
         t.kilometers,
         t.status,
         t.collected_amount,
         t.notes,
         t.paid_at,
         DATE_FORMAT(t.driver_paid_at, '%Y-%m-%d') AS driver_paid_at,
         DATE_FORMAT(t.driver_done_at, '%Y-%m-%d') AS driver_done_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name,
         p.name AS place_name,
         COALESCE(u.full_name, u.email) AS created_by_name,
         EXISTS(SELECT 1 FROM saas_tenant_memberships m WHERE m.user_id = t.user_id AND m.tenant_id = t.tenant_id AND m.role = 'camionero') AS created_by_is_driver
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
       LEFT JOIN saas_camiones_places p ON p.id = t.place_id
       LEFT JOIN saasPro_users u ON u.id = t.user_id
       WHERE ${whereParts.join(" AND ")}
       ORDER BY t.trip_date DESC, t.id DESC
       LIMIT ?`,
      values
    );

    return {
      items: rows.map((row) => this.mapTrip(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length,
        limit
      }
    };
  }

  // Viaje cargado por un camionero (14/11/2026): sin km ni valor
  // (kilometers = 0 marca "por valorar"). Mismo formato de notas que usa el
  // frontend (route-from / trip-description / zorra).
  async submitDriverTrip(currentUser: CamionesRequestUser, dto: SubmitCamionesTripDto) {
    const clean = (value: string) => value.replace(/\|\|/g, " ").replace(/\s+/g, " ").trim();
    const tokens = [`route-from::${clean(dto.fromPlaceName)}`, `zorra::${dto.withTrailer ? "si" : "no"}`];
    const description = dto.description ? clean(dto.description) : "";
    if (description) tokens.push(`trip-description::${description}`);
    return this.createTrip(currentUser, {
      clientId: dto.clientId,
      placeId: dto.placeId,
      placeName: dto.placeName ? clean(dto.placeName) : undefined,
      truck: dto.truck,
      tripDate: dto.tripDate,
      kilometers: 0,
      notes: tokens.join("||")
    });
  }

  // Los viajes que cargo este camionero (para que vea que quedaron enviados).
  async listMyTrips(currentUser: CamionesRequestUser) {
    const rows = await this.databaseService.query<CamionesTripRow[]>(
      `SELECT
         t.id, t.tenant_id, t.branch_id, t.client_id, t.place_id, t.user_id, t.trip_date, t.place,
         t.truck, t.kilometers, t.status, t.collected_amount, t.notes, t.paid_at, DATE_FORMAT(t.driver_paid_at, '%Y-%m-%d') AS driver_paid_at, t.driver_done_at, t.created_at, t.updated_at,
         c.name AS client_name, p.name AS place_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
       LEFT JOIN saas_camiones_places p ON p.id = t.place_id
       WHERE t.tenant_id = ? AND t.user_id = ? AND t.status <> 'cancelled'
       ORDER BY t.trip_date DESC, t.id DESC
       LIMIT 30`,
      [currentUser.tenantId, currentUser.userId]
    );
    // El camionero NUNCA recibe el valor del viaje ni el porcentaje: solo que
    // ya esta confirmado y cuanto le corresponde (15/11/2026).
    return {
      items: rows.map((row) => {
        const trip = this.mapTrip(row);
        const valued = trip.kilometers > 0;
        const total = valued ? this.tripTotal(trip.notes, trip.kilometers) : null;
        const token = (prefix: string) => (trip.notes ?? "").split("||").map((t) => t.trim()).find((t) => t.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
        return {
          id: trip.id,
          clientName: trip.clientName,
          from: token("route-from::"),
          to: trip.place,
          tripDate: trip.tripDate,
          truck: trip.truck,
          withTrailer: token("zorra::") === "si",
          confirmed: valued,
          share: total === null ? null : Number(((total * DRIVER_PERCENT) / 100).toFixed(2)),
          done: Boolean(row.driver_done_at),
          paid: Boolean(row.driver_paid_at)
        };
      })
    };
  }

  // Total facturado del viaje: el "trip-total" guardado, o km x tarifa.
  private tripTotal(notes: string | null, kilometers: number): number | null {
    const tokens = (notes ?? "").split("||").map((t) => t.trim());
    const read = (prefix: string) => {
      const raw = tokens.find((t) => t.startsWith(prefix))?.slice(prefix.length).trim();
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const total = read("trip-total::");
    if (total !== null) return total;
    const rate = read("rate-per-km::");
    return rate !== null ? Number((kilometers * rate).toFixed(2)) : null;
  }

  // El camionero avisa que termino el recorrido (solo viajes ya aprobados y propios).
  async finishMyTrip(currentUser: CamionesRequestUser, tripId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_trips SET driver_done_at = COALESCE(driver_done_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND tenant_id = ? AND user_id = ? AND kilometers > 0 AND status <> 'cancelled'`,
      [tripId, currentUser.tenantId, currentUser.userId]
    );
    if (result.affectedRows === 0) {
      throw new BadRequestException("Ese viaje todavía no está aprobado o no es tuyo");
    }
    return { ok: true };
  }

  // El administrador lo marca terminado si el camionero no avisa.
  async finishTripAsAdmin(currentUser: CamionesRequestUser, tripId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_trips SET driver_done_at = COALESCE(driver_done_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND tenant_id = ? AND kilometers > 0 AND status <> 'cancelled'`,
      [tripId, currentUser.tenantId]
    );
    if (result.affectedRows === 0) {
      throw new BadRequestException("Ese viaje todavía no está aprobado");
    }
    return { ok: true };
  }

  // "Pagar" al camionero: marca como pagados sus viajes ya TERMINADOS que
  // todavia no se le pagaron, asi la cuenta vuelve a empezar de cero.
  async payoutDriver(currentUser: CamionesRequestUser, driverUserId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_trips t
       SET t.driver_paid_at = CURRENT_TIMESTAMP
       WHERE t.tenant_id = ? AND t.user_id = ? AND t.kilometers > 0 AND t.status <> 'cancelled'
         AND t.driver_paid_at IS NULL AND t.driver_done_at IS NOT NULL
         AND EXISTS (SELECT 1 FROM saas_tenant_memberships m WHERE m.user_id = t.user_id AND m.tenant_id = t.tenant_id AND m.role = 'camionero')`,
      [currentUser.tenantId, driverUserId]
    );
    return { paidTrips: result.affectedRows };
  }

  async createTrip(currentUser: CamionesRequestUser, dto: CreateCamionesTripDto) {
    const clientRows = await this.databaseService.query<CamionesClientRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         phone,
         notes,
         is_active,
         created_at,
         updated_at
       FROM saas_camiones_clients
       WHERE id = ?
         AND tenant_id = ?
         AND is_active = 1
       LIMIT 1`,
      [dto.clientId, currentUser.tenantId]
    );

    const client = clientRows[0];
    if (!client) {
      throw new BadRequestException("Cliente no encontrado para este tenant");
    }

    let resolvedPlaceId: number | null = null;
    let resolvedPlaceName = dto.placeName?.trim() || "";

    if (dto.placeId) {
      const placeRows = await this.databaseService.query<CamionesPlaceRow[]>(
        `SELECT
           id,
           tenant_id,
           branch_id,
           name,
           notes,
           is_active,
           created_at,
           updated_at
         FROM saas_camiones_places
         WHERE id = ?
           AND tenant_id = ?
           AND is_active = 1
         LIMIT 1`,
        [dto.placeId, currentUser.tenantId]
      );

      const place = placeRows[0];
      if (!place) {
        throw new BadRequestException("Lugar no encontrado para este tenant");
      }

      resolvedPlaceId = place.id;
      resolvedPlaceName = place.name;
    }

    if (!resolvedPlaceName) {
      throw new BadRequestException("Falta el destino");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_camiones_trips (
         tenant_id,
         branch_id,
         client_id,
         place_id,
         user_id,
         trip_date,
         place,
         truck,
         kilometers,
         status,
         collected_amount,
         notes
       )
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'confirmed', NULL, ?)`,
      [
        currentUser.tenantId,
        client.id,
        resolvedPlaceId,
        currentUser.userId,
        dto.tripDate,
        resolvedPlaceName,
        dto.truck ?? null,
        Number(dto.kilometers.toFixed(2)),
        dto.notes?.trim() || null
      ]
    );

    const rows = await this.databaseService.query<CamionesTripRow[]>(
      `SELECT
         t.id,
         t.tenant_id,
         t.branch_id,
         t.client_id,
         t.place_id,
         t.user_id,
         t.trip_date,
         t.place,
         t.truck,
         t.kilometers,
         t.status,
         t.collected_amount,
         t.notes,
         t.paid_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name,
         p.name AS place_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
       LEFT JOIN saas_camiones_places p ON p.id = t.place_id
       WHERE t.id = ?
         AND t.tenant_id = ?
       LIMIT 1`,
      [result.insertId, currentUser.tenantId]
    );

    return {
      trip: this.mapTrip(rows[0])
    };
  }

  async updateTrip(currentUser: CamionesRequestUser, tripId: number, dto: UpdateCamionesTripDto) {
    let resolvedPlaceId: number | null = null;
    let resolvedPlaceName = dto.placeName?.trim() || "";

    if (dto.placeId) {
      const placeRows = await this.databaseService.query<CamionesPlaceRow[]>(
        `SELECT
           id,
           tenant_id,
           branch_id,
           name,
           notes,
           is_active,
           created_at,
           updated_at
         FROM saas_camiones_places
         WHERE id = ?
           AND tenant_id = ?
           AND is_active = 1
         LIMIT 1`,
        [dto.placeId, currentUser.tenantId]
      );

      const place = placeRows[0];
      if (!place) {
        throw new BadRequestException("Lugar no encontrado para este tenant");
      }

      resolvedPlaceId = place.id;
      resolvedPlaceName = place.name;
    }

    if (!resolvedPlaceName) {
      throw new BadRequestException("Falta el destino");
    }

    const normalizedStatus = dto.status ?? "confirmed";
    const collectedAmount =
      dto.collectedAmount === undefined || dto.collectedAmount === null ? null : Number(dto.collectedAmount.toFixed(2));
    const paidAt = normalizedStatus === "paid" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_trips
       SET trip_date = ?,
           place_id = ?,
           place = ?,
           truck = ?,
           kilometers = ?,
           status = ?,
           collected_amount = ?,
           paid_at = ?,
           notes = ?
       WHERE id = ?
         AND tenant_id = ?`,
      [
        dto.tripDate,
        resolvedPlaceId,
        resolvedPlaceName,
        dto.truck ?? null,
        Number(dto.kilometers.toFixed(2)),
        normalizedStatus,
        collectedAmount,
        paidAt,
        dto.notes?.trim() || null,
        tripId,
        currentUser.tenantId
      ]
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Viaje no encontrado para este tenant");
    }

    const rows = await this.databaseService.query<CamionesTripRow[]>(
      `SELECT
         t.id,
         t.tenant_id,
         t.branch_id,
         t.client_id,
         t.place_id,
         t.user_id,
         t.trip_date,
         t.place,
         t.truck,
         t.kilometers,
         t.status,
         t.collected_amount,
         t.notes,
         t.paid_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name,
         p.name AS place_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
       LEFT JOIN saas_camiones_places p ON p.id = t.place_id
       WHERE t.id = ?
         AND t.tenant_id = ?
       LIMIT 1`,
      [tripId, currentUser.tenantId]
    );

    return {
      trip: this.mapTrip(rows[0])
    };
  }

  async markTripPaid(currentUser: CamionesRequestUser, tripId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_trips
       SET status = 'paid',
           collected_amount = NULL,
           paid_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND tenant_id = ?
         AND status <> 'paid'`,
      [tripId, currentUser.tenantId]
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Viaje pendiente no encontrado para este tenant");
    }

    const rows = await this.databaseService.query<CamionesTripRow[]>(
      `SELECT
         t.id,
         t.tenant_id,
         t.branch_id,
         t.client_id,
         t.place_id,
         t.user_id,
         t.trip_date,
         t.place,
         t.truck,
         t.kilometers,
         t.status,
         t.collected_amount,
         t.notes,
         t.paid_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name,
         p.name AS place_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
       LEFT JOIN saas_camiones_places p ON p.id = t.place_id
       WHERE t.id = ?
         AND t.tenant_id = ?
       LIMIT 1`,
      [tripId, currentUser.tenantId]
    );

    return {
      trip: this.mapTrip(rows[0])
    };
  }

  async deleteTrip(currentUser: CamionesRequestUser, tripId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_camiones_trips
       WHERE id = ?
         AND tenant_id = ?
         AND status = 'paid'`,
      [tripId, currentUser.tenantId]
    );

    if (result.affectedRows === 0) {
      throw new BadRequestException("Solo se pueden eliminar viajes pagos de este tenant");
    }

    return { ok: true };
  }

  private mapClient(row: CamionesClientRow | undefined) {
    if (!row) {
      throw new BadRequestException("Cliente no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      name: row.name,
      phone: row.phone,
      notes: row.notes,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapTrip(row: CamionesTripRow | undefined) {
    if (!row || !row.client_name) {
      throw new BadRequestException("Viaje no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      clientId: row.client_id,
      placeId: row.place_id,
      clientName: row.client_name,
      userId: row.user_id,
      createdByName: row.created_by_name ?? null,
      createdByIsDriver: Boolean(row.created_by_is_driver),
      driverPaidAt: row.driver_paid_at ?? null,
      driverDoneAt: row.driver_done_at ?? null,
      tripDate: row.trip_date,
      place: row.place_name || row.place,
      truck: row.truck ?? null,
      kilometers: Number(row.kilometers),
      status: row.status,
      collectedAmount: row.collected_amount === null ? null : Number(row.collected_amount),
      notes: row.notes,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapPlace(row: CamionesPlaceRow | undefined) {
    if (!row) {
      throw new BadRequestException("Lugar no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      name: row.name,
      notes: row.notes,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
