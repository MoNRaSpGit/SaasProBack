import { BadRequestException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CamionesRequestUser } from "./camiones.types";
import { CreateCamionesClientDto } from "./dto/create-camiones-client.dto";
import { CreateCamionesTripDto } from "./dto/create-camiones-trip.dto";
import { ListCamionesClientsDto } from "./dto/list-camiones-clients.dto";
import { ListCamionesTripsDto } from "./dto/list-camiones-trips.dto";

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
      return { item: this.mapClient(existingRows[0]) };
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
         t.user_id,
         t.trip_date,
         t.place,
         t.kilometers,
         t.status,
         t.notes,
         t.paid_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
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

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_camiones_trips (
         tenant_id,
         branch_id,
         client_id,
         user_id,
         trip_date,
         place,
         kilometers,
         status,
         notes
       )
       VALUES (?, NULL, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        currentUser.tenantId,
        client.id,
        currentUser.userId,
        dto.tripDate,
        dto.place.trim(),
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
         t.user_id,
         t.trip_date,
         t.place,
         t.kilometers,
         t.status,
         t.notes,
         t.paid_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
       WHERE t.id = ?
         AND t.tenant_id = ?
       LIMIT 1`,
      [result.insertId, currentUser.tenantId]
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
         t.user_id,
         t.trip_date,
         t.place,
         t.kilometers,
         t.status,
         t.notes,
         t.paid_at,
         t.created_at,
         t.updated_at,
         c.name AS client_name
       FROM saas_camiones_trips t
       INNER JOIN saas_camiones_clients c ON c.id = t.client_id
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
      clientName: row.client_name,
      userId: row.user_id,
      tripDate: row.trip_date,
      place: row.place,
      kilometers: Number(row.kilometers),
      status: row.status,
      notes: row.notes,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
