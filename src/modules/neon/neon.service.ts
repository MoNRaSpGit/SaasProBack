import { BadRequestException, Injectable } from "@nestjs/common";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { NeonAccount, NeonActivity, NeonActivityPayment, NeonClient, NeonRequestUser, NeonShellStatus } from "./neon.types";
import { CreateNeonActivityDto, NeonCommercialStatus } from "./dto/create-neon-activity.dto";
import { CreateNeonClientDto } from "./dto/create-neon-client.dto";
import { ListNeonActivitiesDto } from "./dto/list-neon-activities.dto";
import { ListNeonClientsDto } from "./dto/list-neon-clients.dto";
import { UpdateNeonActivityDto } from "./dto/update-neon-activity.dto";
import { UpdateNeonClientDto } from "./dto/update-neon-client.dto";
import { CreateNeonActivityPaymentDto } from "./dto/create-neon-activity-payment.dto";

type NeonClientRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type NeonAccountRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  name: string;
  account_type: "cash" | "bank";
  opening_balance: string;
  current_balance: string;
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

type NeonActivityPaymentRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  activity_id: number;
  movement_id: number;
  account_id: number;
  account_name: string;
  payment_date: string;
  paid_amount: string;
  description: string | null;
  created_at: string;
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

  async listAccounts(currentUser: NeonRequestUser) {
    await this.ensureDefaultAccounts(currentUser.tenantId);
    const rows = await this.listAccountRows(currentUser.tenantId);

    return {
      items: rows.map((row) => this.mapAccount(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length
      }
    };
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
         COALESCE(p.collected_amount, 0) AS collected_amount,
         GREATEST(a.quoted_amount - COALESCE(p.collected_amount, 0), 0) AS pending_amount,
         a.created_at,
         a.updated_at
       FROM saas_neon_activities a
       LEFT JOIN saas_neon_clients c
         ON c.id = a.client_id
        AND c.tenant_id = a.tenant_id
       LEFT JOIN (
         SELECT
           activity_id,
           SUM(paid_amount) AS collected_amount
         FROM saas_neon_activity_payments
         WHERE tenant_id = ?
         GROUP BY activity_id
       ) p
         ON p.activity_id = a.id
       WHERE ${whereParts.join(" AND ")}
       ORDER BY a.activity_year DESC, a.activity_number DESC
       LIMIT ?`,
      [currentUser.tenantId, ...values]
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
    const payments = await this.listActivityPayments(currentUser.tenantId, activityId);
    return { item: this.mapActivity(row, payments) };
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
    const payments = await this.listActivityPayments(currentUser.tenantId, activityId);
    return { item: this.mapActivity(row, payments) };
  }

  async createActivityPayment(currentUser: NeonRequestUser, activityId: number, dto: CreateNeonActivityPaymentDto) {
    await this.ensureDefaultAccounts(currentUser.tenantId);

    const nextActivity = await this.databaseService.withTransaction(async (connection) => {
      const activity = await this.findActivityRowWithConnection(connection, currentUser.tenantId, activityId);
      const pendingAmount = Number(activity.pending_amount);

      if (pendingAmount <= 0) {
        throw new BadRequestException("La actividad ya no tiene saldo pendiente");
      }

      const paidAmount = Number(dto.paidAmount.toFixed(2));
      if (paidAmount > pendingAmount) {
        throw new BadRequestException("El pago no puede superar el pendiente actual");
      }

      await this.ensureAccountExistsWithConnection(connection, currentUser.tenantId, dto.accountId);

      const [movementResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_neon_movements (
           tenant_id,
           movement_type,
           movement_date,
           account_id,
           total_amount,
           description,
           source_type,
           source_activity_id
         )
         VALUES (?, 'income', ?, ?, ?, ?, 'activity', ?)`,
        [
          currentUser.tenantId,
          dto.paymentDate,
          dto.accountId,
          paidAmount,
          dto.description?.trim() || `Pago actividad #${activity.activity_number}/${activity.activity_year}`,
          activityId
        ]
      );

      await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_neon_activity_payments (
           tenant_id,
           activity_id,
           movement_id,
           paid_amount
         )
         VALUES (?, ?, ?, ?)`,
        [currentUser.tenantId, activityId, movementResult.insertId, paidAmount]
      );

      return this.findActivityRowWithConnection(connection, currentUser.tenantId, activityId);
    });

    const payments = await this.listActivityPayments(currentUser.tenantId, activityId);
    return { item: this.mapActivity(nextActivity, payments) };
  }

  private async ensureDefaultAccounts(tenantId: number) {
    const countRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM saas_neon_accounts
       WHERE tenant_id = ?
         AND deleted_at IS NULL`,
      [tenantId]
    );

    const total = Number(countRows[0]?.total || 0);
    if (total > 0) {
      return;
    }

    await this.databaseService.withTransaction(async (connection) => {
      const [existingRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM saas_neon_accounts
         WHERE tenant_id = ?
           AND deleted_at IS NULL
         FOR UPDATE`,
        [tenantId]
      );

      if (Number(existingRows[0]?.total || 0) > 0) {
        return;
      }

      await connection.execute(
        `INSERT INTO saas_neon_accounts (
           tenant_id,
           name,
           account_type,
           opening_balance
         )
         VALUES
           (?, 'Caja', 'cash', 0),
           (?, 'Banco', 'bank', 0)`,
        [tenantId, tenantId]
      );
    });
  }

  private async listAccountRows(tenantId: number) {
    return this.databaseService.query<NeonAccountRow[]>(
      `SELECT
         a.id,
         a.tenant_id,
         a.name,
         a.account_type,
         a.opening_balance,
         a.opening_balance
           + COALESCE(SUM(CASE WHEN m.movement_type = 'income' THEN m.total_amount ELSE -m.total_amount END), 0)
           AS current_balance,
         a.created_at,
         a.updated_at
       FROM saas_neon_accounts a
       LEFT JOIN saas_neon_movements m
         ON m.account_id = a.id
        AND m.tenant_id = a.tenant_id
        AND m.deleted_at IS NULL
       WHERE a.tenant_id = ?
         AND a.deleted_at IS NULL
       GROUP BY
         a.id,
         a.tenant_id,
         a.name,
         a.account_type,
         a.opening_balance,
         a.created_at,
         a.updated_at
       ORDER BY a.id ASC`,
      [tenantId]
    );
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

  private async ensureAccountExistsWithConnection(connection: PoolConnection, tenantId: number, accountId: number) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id
       FROM saas_neon_accounts
       WHERE id = ?
         AND tenant_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [accountId, tenantId]
    );

    if (!rows[0]) {
      throw new BadRequestException("Cuenta no encontrada para este tenant");
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
         COALESCE(p.collected_amount, 0) AS collected_amount,
         GREATEST(a.quoted_amount - COALESCE(p.collected_amount, 0), 0) AS pending_amount,
         a.created_at,
         a.updated_at
       FROM saas_neon_activities a
       LEFT JOIN saas_neon_clients c
         ON c.id = a.client_id
        AND c.tenant_id = a.tenant_id
       LEFT JOIN (
         SELECT
           activity_id,
           SUM(paid_amount) AS collected_amount
         FROM saas_neon_activity_payments
         WHERE tenant_id = ?
         GROUP BY activity_id
       ) p
         ON p.activity_id = a.id
       WHERE a.id = ?
         AND a.tenant_id = ?
         AND a.deleted_at IS NULL
       LIMIT 1`,
      [tenantId, activityId, tenantId]
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
         COALESCE(p.collected_amount, 0) AS collected_amount,
         GREATEST(a.quoted_amount - COALESCE(p.collected_amount, 0), 0) AS pending_amount,
         a.created_at,
         a.updated_at
       FROM saas_neon_activities a
       LEFT JOIN saas_neon_clients c
         ON c.id = a.client_id
        AND c.tenant_id = a.tenant_id
       LEFT JOIN (
         SELECT
           activity_id,
           SUM(paid_amount) AS collected_amount
         FROM saas_neon_activity_payments
         WHERE tenant_id = ?
         GROUP BY activity_id
       ) p
         ON p.activity_id = a.id
       WHERE a.id = ?
         AND a.tenant_id = ?
         AND a.deleted_at IS NULL
       LIMIT 1`,
      [tenantId, activityId, tenantId]
    );

    if (!rows[0]) {
      throw new BadRequestException("Actividad no encontrada para este tenant");
    }

    return rows[0];
  }

  private async listActivityPayments(tenantId: number, activityId: number) {
    const rows = await this.databaseService.query<NeonActivityPaymentRow[]>(
      `SELECT
         p.id,
         p.tenant_id,
         p.activity_id,
         p.movement_id,
         m.account_id,
         a.name AS account_name,
         m.movement_date AS payment_date,
         p.paid_amount,
         m.description,
         p.created_at
       FROM saas_neon_activity_payments p
       INNER JOIN saas_neon_movements m
         ON m.id = p.movement_id
        AND m.tenant_id = p.tenant_id
       INNER JOIN saas_neon_accounts a
         ON a.id = m.account_id
        AND a.tenant_id = m.tenant_id
       WHERE p.tenant_id = ?
         AND p.activity_id = ?
       ORDER BY m.movement_date DESC, p.id DESC`,
      [tenantId, activityId]
    );

    return rows.map((row) => this.mapPayment(row));
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

  private mapAccount(row: NeonAccountRow | undefined): NeonAccount {
    if (!row) {
      throw new BadRequestException("Cuenta no encontrada");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      accountType: row.account_type,
      openingBalance: Number(row.opening_balance),
      currentBalance: Number(row.current_balance),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapPayment(row: NeonActivityPaymentRow | undefined): NeonActivityPayment {
    if (!row) {
      throw new BadRequestException("Pago no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      activityId: row.activity_id,
      movementId: row.movement_id,
      accountId: row.account_id,
      accountName: row.account_name,
      paymentDate: row.payment_date,
      paidAmount: Number(row.paid_amount),
      description: row.description,
      createdAt: row.created_at
    };
  }

  private mapActivity(row: NeonActivityRow | undefined, payments: NeonActivityPayment[] = []): NeonActivity {
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
      payments,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
