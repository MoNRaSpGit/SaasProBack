import { BadRequestException, Injectable } from "@nestjs/common";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { NeonActivity, NeonClient, NeonRequestUser, NeonShellStatus } from "./neon.types";
import { CreateNeonActivityDto, NeonCommercialStatus } from "./dto/create-neon-activity.dto";
import { CreateNeonClientDto } from "./dto/create-neon-client.dto";
import { ListNeonActivitiesDto } from "./dto/list-neon-activities.dto";
import { ListNeonClientsDto } from "./dto/list-neon-clients.dto";
import { UpdateNeonActivityDto } from "./dto/update-neon-activity.dto";
import { UpdateNeonClientDto } from "./dto/update-neon-client.dto";

type NeonClientRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type NeonActivityRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  activity_number: number;
  activity_year: number;
  activity_date: string;
  description: string;
  client_id: number | null;
  client_name: string | null;
  activity_type: "neon" | "movil_audiovisual" | "otros";
  commercial_status: NeonCommercialStatus;
  quoted_amount: string;
  collected_amount: string;
  pending_amount: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class NeonService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus(currentUser: NeonRequestUser): Promise<NeonShellStatus> {
    await this.databaseService.checkConnection();

    return {
      module: "neon",
      tenant: {
        id: currentUser.tenantId,
        name: currentUser.tenantName,
        slug: currentUser.tenantSlug
      },
      user: {
        id: currentUser.userId,
        email: currentUser.email,
        membershipRole: currentUser.membershipRole
      },
      backend: {
        database: "connected",
        currentTimestamp: new Date().toISOString()
      },
      phase: "shell"
    };
  }

  async listClients(currentUser: NeonRequestUser, query: ListNeonClientsDto) {
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const whereParts = ["tenant_id = ?", "deleted_at IS NULL"];
    const values: Array<string | number> = [currentUser.tenantId];

    if (search) {
      whereParts.push("(name LIKE ? OR phone LIKE ?)");
      const likeValue = `%${search}%`;
      values.push(likeValue, likeValue);
    }

    values.push(limit);

    const rows = await this.databaseService.query<NeonClientRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         phone,
         notes,
         created_at,
         updated_at
       FROM saas_neon_clients
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

  async createClient(currentUser: NeonRequestUser, dto: CreateNeonClientDto) {
    const name = dto.name.trim();
    const phone = dto.phone?.trim() || null;
    const notes = dto.notes?.trim() || null;

    const existingRows = await this.databaseService.query<NeonClientRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         phone,
         notes,
         created_at,
         updated_at
       FROM saas_neon_clients
       WHERE tenant_id = ?
         AND deleted_at IS NULL
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
          `UPDATE saas_neon_clients
           SET phone = ?,
               notes = ?
           WHERE id = ?
             AND tenant_id = ?`,
          [nextPhone, nextNotes, existingClient.id, currentUser.tenantId]
        );

        const refreshedRows = await this.databaseService.query<NeonClientRow[]>(
          `SELECT
             id,
             tenant_id,
             name,
             phone,
             notes,
             created_at,
             updated_at
           FROM saas_neon_clients
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
      `INSERT INTO saas_neon_clients (
         tenant_id,
         name,
         phone,
         notes
       )
       VALUES (?, ?, ?, ?)`,
      [currentUser.tenantId, name, phone, notes]
    );

    const rows = await this.databaseService.query<NeonClientRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         phone,
         notes,
         created_at,
         updated_at
       FROM saas_neon_clients
       WHERE id = ?
         AND tenant_id = ?
       LIMIT 1`,
      [result.insertId, currentUser.tenantId]
    );

    return { item: this.mapClient(rows[0]) };
  }

  async updateClient(currentUser: NeonRequestUser, clientId: number, dto: UpdateNeonClientDto) {
    const currentRows = await this.databaseService.query<NeonClientRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         phone,
         notes,
         created_at,
         updated_at
       FROM saas_neon_clients
       WHERE id = ?
         AND tenant_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clientId, currentUser.tenantId]
    );

    const currentClient = currentRows[0];
    if (!currentClient) {
      throw new BadRequestException("Cliente no encontrado para este tenant");
    }

    const name = dto.name?.trim() || currentClient.name;
    const phone = dto.phone === undefined ? currentClient.phone : dto.phone.trim() || null;
    const notes = dto.notes === undefined ? currentClient.notes : dto.notes.trim() || null;

    const duplicateRows = await this.databaseService.query<NeonClientRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         phone,
         notes,
         created_at,
         updated_at
       FROM saas_neon_clients
       WHERE tenant_id = ?
         AND deleted_at IS NULL
         AND LOWER(name) = LOWER(?)
         AND id <> ?
       LIMIT 1`,
      [currentUser.tenantId, name, clientId]
    );

    if (duplicateRows[0]) {
      throw new BadRequestException("Ya existe otro cliente con ese nombre");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_neon_clients
       SET name = ?,
           phone = ?,
           notes = ?
       WHERE id = ?
         AND tenant_id = ?
         AND deleted_at IS NULL`,
      [name, phone, notes, clientId, currentUser.tenantId]
    );

    const rows = await this.databaseService.query<NeonClientRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         phone,
         notes,
         created_at,
         updated_at
       FROM saas_neon_clients
       WHERE id = ?
         AND tenant_id = ?
       LIMIT 1`,
      [clientId, currentUser.tenantId]
    );

    return { item: this.mapClient(rows[0]) };
  }

  async listActivities(currentUser: NeonRequestUser, query: ListNeonActivitiesDto) {
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const whereParts = ["a.tenant_id = ?", "a.deleted_at IS NULL"];
    const values: Array<string | number> = [currentUser.tenantId];

    if (search) {
      whereParts.push("(a.description LIKE ? OR c.name LIKE ?)");
      const likeValue = `%${search}%`;
      values.push(likeValue, likeValue);
    }

    if (query.activityType) {
      whereParts.push("a.activity_type = ?");
      values.push(query.activityType);
    }

    if (query.commercialStatus) {
      whereParts.push("a.commercial_status = ?");
      values.push(query.commercialStatus);
    }

    values.push(limit);

    const rows = await this.databaseService.query<NeonActivityRow[]>(
      `SELECT
         a.id,
         a.tenant_id,
         a.activity_number,
         a.activity_year,
         a.activity_date,
         a.description,
         a.client_id,
         c.name AS client_name,
         a.activity_type,
         a.commercial_status,
         a.quoted_amount,
         CAST(0 AS DECIMAL(12,2)) AS collected_amount,
         a.quoted_amount AS pending_amount,
         a.created_at,
         a.updated_at
       FROM saas_neon_activities a
       LEFT JOIN saas_neon_clients c
         ON c.id = a.client_id
        AND c.tenant_id = a.tenant_id
       WHERE ${whereParts.join(" AND ")}
       ORDER BY a.activity_year DESC, a.activity_number DESC
       LIMIT ?`,
      values
    );

    return {
      items: rows.map((row) => this.mapActivity(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length,
        limit
      }
    };
  }

  async getActivity(currentUser: NeonRequestUser, activityId: number) {
    const row = await this.findActivityRow(currentUser.tenantId, activityId);
    return { item: this.mapActivity(row) };
  }

  async createActivity(currentUser: NeonRequestUser, dto: CreateNeonActivityDto) {
    if (dto.clientId) {
      await this.ensureClientExists(currentUser.tenantId, dto.clientId);
    }

    const activity = await this.databaseService.withTransaction(async (connection) => {
      const activityYear = new Date(dto.activityDate).getUTCFullYear();
      const [nextNumberRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(activity_number), 0) + 1 AS next_number
         FROM saas_neon_activities
         WHERE tenant_id = ?
           AND activity_year = ?
         FOR UPDATE`,
        [currentUser.tenantId, activityYear]
      );

      const nextNumber = Number(nextNumberRows[0]?.next_number || 1);

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_neon_activities (
           tenant_id,
           activity_number,
           activity_year,
           activity_date,
           description,
           client_id,
           activity_type,
           commercial_status,
           quoted_amount
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          currentUser.tenantId,
          nextNumber,
          activityYear,
          dto.activityDate,
          dto.description.trim(),
          dto.clientId ?? null,
          dto.activityType,
          dto.commercialStatus ?? "pendiente_de_facturar",
          Number(dto.quotedAmount.toFixed(2))
        ]
      );

      return this.findActivityRowWithConnection(connection, currentUser.tenantId, result.insertId);
    });

    return { item: this.mapActivity(activity) };
  }

  async updateActivity(currentUser: NeonRequestUser, activityId: number, dto: UpdateNeonActivityDto) {
    const currentActivity = await this.findActivityRow(currentUser.tenantId, activityId);

    if (dto.clientId) {
      await this.ensureClientExists(currentUser.tenantId, dto.clientId);
    }

    const nextValues = {
      activityDate: dto.activityDate ?? currentActivity.activity_date,
      description: dto.description?.trim() || currentActivity.description,
      clientId: dto.clientId === undefined ? currentActivity.client_id : dto.clientId,
      activityType: dto.activityType ?? currentActivity.activity_type,
      commercialStatus: dto.commercialStatus ?? currentActivity.commercial_status,
      quotedAmount:
        dto.quotedAmount === undefined ? Number(currentActivity.quoted_amount) : Number(dto.quotedAmount.toFixed(2))
    };

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_neon_activities
       SET activity_date = ?,
           description = ?,
           client_id = ?,
           activity_type = ?,
           commercial_status = ?,
           quoted_amount = ?
       WHERE id = ?
         AND tenant_id = ?
         AND deleted_at IS NULL`,
      [
        nextValues.activityDate,
        nextValues.description,
        nextValues.clientId ?? null,
        nextValues.activityType,
        nextValues.commercialStatus,
        nextValues.quotedAmount,
        activityId,
        currentUser.tenantId
      ]
    );

    const row = await this.findActivityRow(currentUser.tenantId, activityId);
    return { item: this.mapActivity(row) };
  }

  private async ensureClientExists(tenantId: number, clientId: number) {
    const rows = await this.databaseService.query<NeonClientRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         phone,
         notes,
         created_at,
         updated_at
       FROM saas_neon_clients
       WHERE id = ?
         AND tenant_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clientId, tenantId]
    );

    if (!rows[0]) {
      throw new BadRequestException("Cliente no encontrado para este tenant");
    }
  }

  private async findActivityRow(tenantId: number, activityId: number) {
    const rows = await this.databaseService.query<NeonActivityRow[]>(
      `SELECT
         a.id,
         a.tenant_id,
         a.activity_number,
         a.activity_year,
         a.activity_date,
         a.description,
         a.client_id,
         c.name AS client_name,
         a.activity_type,
         a.commercial_status,
         a.quoted_amount,
         CAST(0 AS DECIMAL(12,2)) AS collected_amount,
         a.quoted_amount AS pending_amount,
         a.created_at,
         a.updated_at
       FROM saas_neon_activities a
       LEFT JOIN saas_neon_clients c
         ON c.id = a.client_id
        AND c.tenant_id = a.tenant_id
       WHERE a.id = ?
         AND a.tenant_id = ?
         AND a.deleted_at IS NULL
       LIMIT 1`,
      [activityId, tenantId]
    );

    if (!rows[0]) {
      throw new BadRequestException("Actividad no encontrada para este tenant");
    }

    return rows[0];
  }

  private async findActivityRowWithConnection(connection: PoolConnection, tenantId: number, activityId: number) {
    const [rows] = await connection.query<NeonActivityRow[]>(
      `SELECT
         a.id,
         a.tenant_id,
         a.activity_number,
         a.activity_year,
         a.activity_date,
         a.description,
         a.client_id,
         c.name AS client_name,
         a.activity_type,
         a.commercial_status,
         a.quoted_amount,
         CAST(0 AS DECIMAL(12,2)) AS collected_amount,
         a.quoted_amount AS pending_amount,
         a.created_at,
         a.updated_at
       FROM saas_neon_activities a
       LEFT JOIN saas_neon_clients c
         ON c.id = a.client_id
        AND c.tenant_id = a.tenant_id
       WHERE a.id = ?
         AND a.tenant_id = ?
         AND a.deleted_at IS NULL
       LIMIT 1`,
      [activityId, tenantId]
    );

    if (!rows[0]) {
      throw new BadRequestException("Actividad no encontrada para este tenant");
    }

    return rows[0];
  }

  private mapClient(row: NeonClientRow | undefined): NeonClient {
    if (!row) {
      throw new BadRequestException("Cliente no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      phone: row.phone,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapActivity(row: NeonActivityRow | undefined): NeonActivity {
    if (!row) {
      throw new BadRequestException("Actividad no encontrada");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      activityNumber: row.activity_number,
      activityYear: row.activity_year,
      activityDate: row.activity_date,
      description: row.description,
      clientId: row.client_id,
      clientName: row.client_name,
      activityType: row.activity_type,
      commercialStatus: row.commercial_status,
      quotedAmount: Number(row.quoted_amount),
      collectedAmount: Number(row.collected_amount),
      pendingAmount: Number(row.pending_amount),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
