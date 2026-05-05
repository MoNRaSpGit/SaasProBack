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

type CamionesTripRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  client_id: number;
  place_id: number | null;
  user_id: number;
  trip_date: string;
  place: string;
  kilometers: string;
  status: "pending" | "paid" | "cancelled";
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  place_name?: string;
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
    const name = dto.name.trim();
    const phone = dto.phone?.trim() || null;
    const notes = dto.notes?.trim() || null;

    const existingRows = await this.databaseService.query<CamionesClientRow[]>(
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
         AND LOWER(name) = LOWER(?)
       LIMIT 1`,
      [currentUser.tenantId, name]
    );

    if (existingRows[0]) {
      const existingClient = existingRows[0];
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
    const name = dto.name.trim();
    const phone = dto.phone?.trim() || null;
    const notes = dto.notes?.trim() || null;

    const duplicateRows = await this.databaseService.query<CamionesClientRow[]>(
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
         AND LOWER(name) = LOWER(?)
         AND id <> ?
       LIMIT 1`,
      [currentUser.tenantId, name, clientId]
    );

    if (duplicateRows[0]) {
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
         t.kilometers,
         t.status,
         t.notes,
         t.paid_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name,
         p.name AS place_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
       LEFT JOIN saas_camiones_places p ON p.id = t.place_id
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
         kilometers,
         status,
         notes
       )
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        currentUser.tenantId,
        client.id,
        resolvedPlaceId,
        currentUser.userId,
        dto.tripDate,
        resolvedPlaceName,
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
         t.kilometers,
         t.status,
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

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camiones_trips
       SET trip_date = ?,
           place_id = ?,
           place = ?,
           kilometers = ?,
           notes = ?
       WHERE id = ?
         AND tenant_id = ?`,
      [
        dto.tripDate,
        resolvedPlaceId,
        resolvedPlaceName,
        Number(dto.kilometers.toFixed(2)),
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
         t.kilometers,
         t.status,
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
           paid_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND tenant_id = ?
         AND status = 'pending'`,
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
         t.kilometers,
         t.status,
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
      tripDate: row.trip_date,
      place: row.place_name || row.place,
      kilometers: Number(row.kilometers),
      status: row.status,
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
