import { BadRequestException, Injectable } from "@nestjs/common";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import {
  NeonAccount,
  NeonActivity,
  NeonActivityPayment,
  NeonCategory,
  NeonClient,
  NeonExpense,
  NeonJournalAllocation,
  NeonJournalEntry,
  NeonRequestUser,
  NeonShellStatus
} from "./neon.types";
import { CreateNeonAccountDto } from "./dto/create-neon-account.dto";
import { CreateNeonActivityDto, NeonCommercialStatus } from "./dto/create-neon-activity.dto";
import { CreateNeonActivityPaymentDto } from "./dto/create-neon-activity-payment.dto";
import {
  CreateNeonCategoryDto,
  NeonCategoryClassification,
  NeonCategoryMovementType
} from "./dto/create-neon-category.dto";
import { CreateNeonClientDto } from "./dto/create-neon-client.dto";
import {
  CreateNeonJournalAllocationDto,
  CreateNeonJournalEntryDto,
  NeonCostCenterType,
  NeonExpenseKind,
  NeonJournalMovementType
} from "./dto/create-neon-journal-entry.dto";
import { CreateNeonExpenseDto, NeonExpenseDestinationType } from "./dto/create-neon-expense.dto";
import { ListNeonActivitiesDto } from "./dto/list-neon-activities.dto";
import { ListNeonCategoriesDto } from "./dto/list-neon-categories.dto";
import { ListNeonClientsDto } from "./dto/list-neon-clients.dto";
import { ListNeonJournalDto } from "./dto/list-neon-journal.dto";
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

type NeonAccountRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  name: string;
  account_type: "cash" | "bank" | "credit";
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

type NeonCategoryRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  name: string;
  movement_type: NeonCategoryMovementType;
  classification: NeonCategoryClassification;
  is_system: number;
  created_at: string;
  updated_at: string;
};

type NeonExpenseRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  movement_date: string;
  account_id: number;
  account_name: string;
  category_id: number;
  category_name: string;
  category_classification: NeonCategoryClassification;
  total_amount: string;
  description: string | null;
  destination_type: NeonExpenseDestinationType;
  destination_activity_id: number | null;
  destination_activity_code: string | null;
  destination_activity_description: string | null;
  destination_label: string | null;
  created_at: string;
  updated_at: string;
};

type NeonJournalRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  movement_type: NeonJournalMovementType;
  movement_date: string;
  account_id: number;
  account_name: string;
  total_amount: string;
  description: string | null;
  provider_name: string | null;
  document_ref: string | null;
  quantity: string | null;
  unit_label: string | null;
  currency_code: "UYU" | "USD" | null;
  expense_kind: "operational" | "credit_settlement" | null;
  credit_card_label: string | null;
  due_date: string | null;
  source_type: "activity" | "independent";
  source_activity_id: number | null;
  source_activity_code: string | null;
  source_activity_description: string | null;
  allocation_id: number | null;
  destination_type: NeonCostCenterType | null;
  destination_activity_id: number | null;
  destination_activity_code: string | null;
  destination_activity_description: string | null;
  destination_label: string | null;
  allocation_amount: string | null;
  allocation_metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_EXPENSE_CATEGORIES: Array<{
  name: string;
  classification: NeonCategoryClassification;
}> = [
  { name: "Nafta", classification: "empresa" },
  { name: "Alquiler", classification: "empresa" },
  { name: "Servicios", classification: "empresa" },
  { name: "Gastos personales", classification: "personal" },
  { name: "Otros", classification: "empresa" }
];

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

  async createAccount(currentUser: NeonRequestUser, dto: CreateNeonAccountDto) {
    await this.ensureDefaultAccounts(currentUser.tenantId);

    const name = dto.name.trim();
    const openingBalance = Number((dto.openingBalance ?? 0).toFixed(2));

    const duplicateRows = await this.databaseService.query<NeonAccountRow[]>(
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
         AND LOWER(a.name) = LOWER(?)
       GROUP BY
         a.id,
         a.tenant_id,
         a.name,
         a.account_type,
         a.opening_balance,
         a.created_at,
         a.updated_at
       LIMIT 1`,
      [currentUser.tenantId, name]
    );

    if (duplicateRows[0]) {
      return { item: this.mapAccount(duplicateRows[0]) };
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_neon_accounts (
         tenant_id,
         name,
         account_type,
         opening_balance
       )
       VALUES (?, ?, ?, ?)`,
      [currentUser.tenantId, name, dto.accountType, openingBalance]
    );

    const rows = await this.databaseService.query<NeonAccountRow[]>(
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
       WHERE a.id = ?
         AND a.tenant_id = ?
       GROUP BY
         a.id,
         a.tenant_id,
         a.name,
         a.account_type,
         a.opening_balance,
         a.created_at,
         a.updated_at
       LIMIT 1`,
      [result.insertId, currentUser.tenantId]
    );

    return { item: this.mapAccount(rows[0]) };
  }

  async listCategories(currentUser: NeonRequestUser, query: ListNeonCategoriesDto) {
    await this.ensureDefaultCategories(currentUser.tenantId);

    const whereParts = ["tenant_id = ?", "deleted_at IS NULL"];
    const values: Array<number | string> = [currentUser.tenantId];

    if (query.movementType) {
      whereParts.push("movement_type = ?");
      values.push(query.movementType);
    }

    const rows = await this.databaseService.query<NeonCategoryRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         movement_type,
         classification,
         is_system,
         created_at,
         updated_at
       FROM saas_neon_categories
       WHERE ${whereParts.join(" AND ")}
       ORDER BY is_system DESC, name ASC`,
      values
    );

    return {
      items: rows.map((row) => this.mapCategory(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length
      }
    };
  }

  async createCategory(currentUser: NeonRequestUser, dto: CreateNeonCategoryDto) {
    await this.ensureDefaultCategories(currentUser.tenantId);

    const name = dto.name.trim();
    const movementType = dto.movementType ?? "expense";
    const classification = dto.classification ?? "empresa";

    const duplicateRows = await this.databaseService.query<NeonCategoryRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         movement_type,
         classification,
         is_system,
         created_at,
         updated_at
       FROM saas_neon_categories
       WHERE tenant_id = ?
         AND deleted_at IS NULL
         AND movement_type = ?
         AND LOWER(name) = LOWER(?)
       LIMIT 1`,
      [currentUser.tenantId, movementType, name]
    );

    if (duplicateRows[0]) {
      return { item: this.mapCategory(duplicateRows[0]) };
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_neon_categories (
         tenant_id,
         name,
         movement_type,
         classification,
         is_system
       )
       VALUES (?, ?, ?, ?, 0)`,
      [currentUser.tenantId, name, movementType, classification]
    );

    const rows = await this.databaseService.query<NeonCategoryRow[]>(
      `SELECT
         id,
         tenant_id,
         name,
         movement_type,
         classification,
         is_system,
         created_at,
         updated_at
       FROM saas_neon_categories
       WHERE id = ?
         AND tenant_id = ?
       LIMIT 1`,
      [result.insertId, currentUser.tenantId]
    );

    return { item: this.mapCategory(rows[0]) };
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
           alloc.destination_activity_id AS activity_id,
           SUM(alloc.amount) AS collected_amount
         FROM saas_neon_movement_allocations alloc
         INNER JOIN saas_neon_movements m
           ON m.id = alloc.movement_id
          AND m.tenant_id = alloc.tenant_id
         WHERE alloc.tenant_id = ?
           AND alloc.destination_type = 'activity'
           AND alloc.destination_activity_id IS NOT NULL
           AND m.movement_type = 'income'
           AND m.deleted_at IS NULL
         GROUP BY alloc.destination_activity_id
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
          this.normalizeStoredCommercialStatus(dto.commercialStatus ?? "pendiente_de_facturar"),
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
      commercialStatus: this.normalizeStoredCommercialStatus(dto.commercialStatus ?? currentActivity.commercial_status),
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
        `INSERT INTO saas_neon_movement_allocations (
           tenant_id,
           movement_id,
           destination_type,
           destination_activity_id,
           destination_label,
           amount,
           metadata_json
         )
         VALUES (?, ?, 'activity', ?, NULL, ?, NULL)`,
        [currentUser.tenantId, movementResult.insertId, activityId, paidAmount]
      );

      return this.findActivityRowWithConnection(connection, currentUser.tenantId, activityId);
    });

    const payments = await this.listActivityPayments(currentUser.tenantId, activityId);
    return { item: this.mapActivity(nextActivity, payments) };
  }

  async listExpenses(currentUser: NeonRequestUser) {
    await this.ensureDefaultAccounts(currentUser.tenantId);
    await this.ensureDefaultCategories(currentUser.tenantId);

    const rows = await this.databaseService.query<NeonExpenseRow[]>(
      `SELECT
         m.id,
         m.tenant_id,
         m.movement_date,
         m.account_id,
         a.name AS account_name,
         m.category_id,
         c.name AS category_name,
         c.classification AS category_classification,
         m.total_amount,
         m.description,
         alloc.destination_type,
         alloc.destination_activity_id,
         CASE
           WHEN alloc.destination_activity_id IS NULL THEN NULL
           ELSE CONCAT('#', act.activity_number, '/', act.activity_year)
         END AS destination_activity_code,
         act.description AS destination_activity_description,
         alloc.destination_label,
         m.created_at,
         m.updated_at
       FROM saas_neon_movements m
       INNER JOIN saas_neon_accounts a
         ON a.id = m.account_id
        AND a.tenant_id = m.tenant_id
       INNER JOIN saas_neon_categories c
         ON c.id = m.category_id
        AND c.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_movement_allocations alloc
         ON alloc.movement_id = m.id
        AND alloc.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_activities act
         ON act.id = alloc.destination_activity_id
        AND act.tenant_id = alloc.tenant_id
       WHERE m.tenant_id = ?
         AND m.movement_type = 'expense'
         AND m.deleted_at IS NULL
       ORDER BY m.movement_date DESC, m.id DESC`,
      [currentUser.tenantId]
    );

    return {
      items: rows.map((row) => this.mapExpense(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length
      }
    };
  }

  async createExpense(currentUser: NeonRequestUser, dto: CreateNeonExpenseDto) {
    await this.ensureDefaultAccounts(currentUser.tenantId);
    await this.ensureDefaultCategories(currentUser.tenantId);

    const totalAmount = Number(dto.totalAmount.toFixed(2));
    const description = dto.description?.trim() || null;
    const destinationLabel = dto.destinationLabel?.trim() || null;

    const expense = await this.databaseService.withTransaction(async (connection) => {
      await this.ensureAccountExistsWithConnection(connection, currentUser.tenantId, dto.accountId);
      await this.ensureCategoryExistsWithConnection(connection, currentUser.tenantId, dto.categoryId, "expense");

      if (dto.destinationType === "activity") {
        if (!dto.destinationActivityId) {
          throw new BadRequestException("Falta elegir la actividad destino");
        }

        await this.findActivityRowWithConnection(connection, currentUser.tenantId, dto.destinationActivityId);
      }

      if (dto.destinationType !== "activity" && !destinationLabel) {
        throw new BadRequestException("Falta la etiqueta del destino");
      }

      const [movementResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_neon_movements (
           tenant_id,
           movement_type,
           movement_date,
           account_id,
           total_amount,
           description,
           category_id,
           source_type,
           source_activity_id
         )
         VALUES (?, 'expense', ?, ?, ?, ?, ?, 'independent', NULL)`,
        [currentUser.tenantId, dto.expenseDate, dto.accountId, totalAmount, description, dto.categoryId]
      );

      await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_neon_movement_allocations (
           tenant_id,
           movement_id,
           destination_type,
           destination_activity_id,
           destination_label,
           amount,
           metadata_json
         )
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [
          currentUser.tenantId,
          movementResult.insertId,
          dto.destinationType,
          dto.destinationType === "activity" ? dto.destinationActivityId ?? null : null,
          dto.destinationType === "activity" ? null : destinationLabel,
          totalAmount
        ]
      );

      return this.findExpenseRowWithConnection(connection, currentUser.tenantId, movementResult.insertId);
    });

    return { item: this.mapExpense(expense) };
  }

  async listJournal(currentUser: NeonRequestUser, query: ListNeonJournalDto) {
    await this.ensureDefaultAccounts(currentUser.tenantId);

    const limit = query.limit ?? 50;
    const whereParts = ["m.tenant_id = ?", "m.deleted_at IS NULL"];
    const values: Array<string | number> = [currentUser.tenantId];

    if (query.movementType) {
      whereParts.push("m.movement_type = ?");
      values.push(query.movementType);
    }

    if (query.accountId) {
      whereParts.push("m.account_id = ?");
      values.push(query.accountId);
    }

    if (query.costCenterType) {
      whereParts.push("alloc.destination_type = ?");
      values.push(query.costCenterType);
    }

    if (query.dateFrom) {
      whereParts.push("m.movement_date >= ?");
      values.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereParts.push("m.movement_date <= ?");
      values.push(query.dateTo);
    }

    if (query.search?.trim()) {
      const likeValue = `%${query.search.trim()}%`;
      whereParts.push(
        "(m.description LIKE ? OR m.provider_name LIKE ? OR m.document_ref LIKE ? OR a.name LIKE ? OR src_act.description LIKE ? OR alloc.destination_label LIKE ?)"
      );
      values.push(likeValue, likeValue, likeValue, likeValue, likeValue, likeValue);
    }

    const rows = await this.databaseService.query<NeonJournalRow[]>(
      `SELECT
         m.id,
         m.tenant_id,
         m.movement_type,
         m.movement_date,
         m.account_id,
         a.name AS account_name,
         m.total_amount,
         m.description,
         m.provider_name,
         m.document_ref,
         m.quantity,
         m.unit_label,
         m.currency_code,
         m.expense_kind,
         m.credit_card_label,
         m.due_date,
         m.source_type,
         m.source_activity_id,
         CASE
           WHEN src_act.id IS NULL THEN NULL
           ELSE CONCAT('#', src_act.activity_number, '/', src_act.activity_year)
         END AS source_activity_code,
         src_act.description AS source_activity_description,
         alloc.id AS allocation_id,
         alloc.destination_type,
         alloc.destination_activity_id,
         CASE
           WHEN alloc_act.id IS NULL THEN NULL
           ELSE CONCAT('#', alloc_act.activity_number, '/', alloc_act.activity_year)
         END AS destination_activity_code,
         alloc_act.description AS destination_activity_description,
         alloc.destination_label,
         alloc.amount AS allocation_amount,
         CAST(alloc.metadata_json AS CHAR) AS allocation_metadata_json,
         m.created_at,
         m.updated_at
       FROM saas_neon_movements m
       INNER JOIN saas_neon_accounts a
         ON a.id = m.account_id
        AND a.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_activities src_act
         ON src_act.id = m.source_activity_id
        AND src_act.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_movement_allocations alloc
         ON alloc.movement_id = m.id
        AND alloc.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_activities alloc_act
         ON alloc_act.id = alloc.destination_activity_id
        AND alloc_act.tenant_id = alloc.tenant_id
       WHERE ${whereParts.join(" AND ")}
       ORDER BY m.movement_date DESC, m.id DESC, alloc.id ASC
       LIMIT ?`,
      [...values, limit * 10]
    );

    const items = this.mapJournalEntries(rows).slice(0, limit);

    return {
      items,
      meta: {
        tenantId: currentUser.tenantId,
        count: items.length,
        limit
      }
    };
  }

  async createJournalEntry(currentUser: NeonRequestUser, dto: CreateNeonJournalEntryDto) {
    await this.ensureDefaultAccounts(currentUser.tenantId);

    const totalAmount = Number(dto.totalAmount.toFixed(2));
    const description = dto.description?.trim() || null;
    const providerName = dto.providerName?.trim() || null;
    const documentRef = dto.documentRef?.trim() || null;
    const quantity = dto.quantity === undefined ? null : Number(dto.quantity.toFixed(2));
    const unitLabel = dto.unitLabel?.trim() || null;
    const currencyCode = dto.currencyCode ?? null;
    const expenseKind: NeonExpenseKind | null = dto.movementType === "expense" ? dto.expenseKind ?? "operational" : null;
    const creditCardLabel = dto.creditCardLabel?.trim() || null;
    const dueDate = dto.dueDate || null;
    const allocations = this.normalizeJournalAllocations(dto);

    const entry = await this.databaseService.withTransaction(async (connection) => {
      const account = await this.findAccountRowWithConnection(connection, currentUser.tenantId, dto.accountId);

      if (dto.movementType === "expense") {
        if (!currencyCode) {
          throw new BadRequestException("Falta la moneda del gasto");
        }

        if (expenseKind === "credit_settlement") {
          if (account.account_type === "credit") {
            throw new BadRequestException("El pago de tarjeta debe salir desde caja o banco");
          }

          if (!creditCardLabel) {
            throw new BadRequestException("Falta la tarjeta a cancelar");
          }
        } else {
          if (!providerName) {
            throw new BadRequestException("Falta el proveedor del gasto");
          }

          if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
            throw new BadRequestException("La cantidad del gasto debe ser valida");
          }

          if (!unitLabel) {
            throw new BadRequestException("Falta la unidad del gasto");
          }
        }

        if (account.account_type === "credit" && expenseKind !== "credit_settlement") {
          if (!creditCardLabel) {
            throw new BadRequestException("Falta la tarjeta para registrar el gasto a credito");
          }

          if (!dueDate) {
            throw new BadRequestException("Falta el vencimiento para registrar el gasto a credito");
          }
        }
      }

      let totalAllocatedCents = 0;
      for (const allocation of allocations) {
        totalAllocatedCents += this.toMoneyCents(allocation.amount);

        if (allocation.destinationType === "activity") {
          if (!allocation.destinationActivityId) {
            throw new BadRequestException("Falta elegir la actividad del centro de costo");
          }

          await this.findActivityRowWithConnection(connection, currentUser.tenantId, allocation.destinationActivityId);
        }

        if (
          (allocation.destinationType === "vehicle" ||
            allocation.destinationType === "other" ||
            allocation.destinationType === "personal" ||
            allocation.destinationType === "rental") &&
          !allocation.destinationLabel?.trim()
        ) {
          throw new BadRequestException("Falta la etiqueta del centro de costo");
        }
      }

      if (allocations.length > 0 && totalAllocatedCents !== this.toMoneyCents(totalAmount)) {
        throw new BadRequestException("La suma de las lineas debe coincidir con el monto total");
      }

      const sourceType = allocations.length === 1 && allocations[0].destinationType === "activity" ? "activity" : "independent";
      const sourceActivityId = sourceType === "activity" ? allocations[0].destinationActivityId ?? null : null;

      const [movementResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_neon_movements (
           tenant_id,
           movement_type,
           movement_date,
           account_id,
           total_amount,
           description,
           provider_name,
           document_ref,
           quantity,
           unit_label,
           currency_code,
           expense_kind,
           credit_card_label,
           due_date,
           source_type,
           source_activity_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          currentUser.tenantId,
          dto.movementType,
          dto.movementDate,
          dto.accountId,
          totalAmount,
          description,
          dto.movementType === "expense" ? providerName : null,
          dto.movementType === "expense" ? documentRef : null,
          dto.movementType === "expense" && expenseKind !== "credit_settlement" ? quantity : null,
          dto.movementType === "expense" && expenseKind !== "credit_settlement" ? unitLabel : null,
          dto.movementType === "expense" ? currencyCode : null,
          expenseKind,
          dto.movementType === "expense" ? creditCardLabel : null,
          dto.movementType === "expense" && account.account_type === "credit" && expenseKind !== "credit_settlement" ? dueDate : null,
          sourceType,
          sourceActivityId
        ]
      );

      for (const allocation of allocations) {
        const destinationLabel =
          allocation.destinationType === "activity" ? null : allocation.destinationLabel?.trim() || null;
        const metadataJson =
          allocation.destinationType === "vehicle"
            ? JSON.stringify({
                kilometers: allocation.kilometers ?? null,
                liters: allocation.liters ?? null
              })
            : null;

        await connection.execute<ResultSetHeader>(
          `INSERT INTO saas_neon_movement_allocations (
             tenant_id,
             movement_id,
             destination_type,
             destination_activity_id,
             destination_label,
             amount,
             metadata_json
           )
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            currentUser.tenantId,
            movementResult.insertId,
            allocation.destinationType,
            allocation.destinationType === "activity" ? allocation.destinationActivityId ?? null : null,
            destinationLabel,
            Number(allocation.amount.toFixed(2)),
            metadataJson
          ]
        );
      }

      return this.findJournalRowsWithConnection(connection, currentUser.tenantId, movementResult.insertId);
    });

    return { item: this.mapJournalEntries(entry)[0] };
  }

  private normalizeJournalAllocations(dto: CreateNeonJournalEntryDto): CreateNeonJournalAllocationDto[] {
    if (dto.allocations?.length) {
      return dto.allocations.map((allocation) => ({
        ...allocation,
        destinationLabel: allocation.destinationLabel?.trim()
      }));
    }

    if (!dto.costCenterType) {
      return [];
    }

    return [
      {
        destinationType: dto.costCenterType,
        destinationActivityId: dto.destinationActivityId,
        destinationLabel: dto.destinationLabel?.trim(),
        amount: dto.totalAmount,
        kilometers: dto.kilometers,
        liters: dto.liters
      }
    ];
  }

  private toMoneyCents(value: number) {
    return Math.round(value * 100);
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

  private async ensureDefaultCategories(tenantId: number) {
    const countRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM saas_neon_categories
       WHERE tenant_id = ?
         AND deleted_at IS NULL
         AND movement_type = 'expense'`,
      [tenantId]
    );

    if (Number(countRows[0]?.total || 0) > 0) {
      return;
    }

    await this.databaseService.withTransaction(async (connection) => {
      const [existingRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM saas_neon_categories
         WHERE tenant_id = ?
           AND deleted_at IS NULL
           AND movement_type = 'expense'
         FOR UPDATE`,
        [tenantId]
      );

      if (Number(existingRows[0]?.total || 0) > 0) {
        return;
      }

      for (const category of DEFAULT_EXPENSE_CATEGORIES) {
        await connection.execute(
          `INSERT INTO saas_neon_categories (
             tenant_id,
             name,
             movement_type,
             classification,
             is_system
           )
           VALUES (?, ?, 'expense', ?, 1)`,
          [tenantId, category.name, category.classification]
        );
      }
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
    await this.findAccountRowWithConnection(connection, tenantId, accountId);
  }

  private async findAccountRowWithConnection(connection: PoolConnection, tenantId: number, accountId: number) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT
         id,
         tenant_id,
         name,
         account_type,
         opening_balance,
         opening_balance AS current_balance,
         created_at,
         updated_at
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

    return rows[0] as NeonAccountRow;
  }

  private async ensureCategoryExistsWithConnection(
    connection: PoolConnection,
    tenantId: number,
    categoryId: number,
    movementType: NeonCategoryMovementType
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id
       FROM saas_neon_categories
       WHERE id = ?
         AND tenant_id = ?
         AND movement_type = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [categoryId, tenantId, movementType]
    );

    if (!rows[0]) {
      throw new BadRequestException("Categoria no encontrada para este tenant");
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
           alloc.destination_activity_id AS activity_id,
           SUM(alloc.amount) AS collected_amount
         FROM saas_neon_movement_allocations alloc
         INNER JOIN saas_neon_movements m
           ON m.id = alloc.movement_id
          AND m.tenant_id = alloc.tenant_id
         WHERE alloc.tenant_id = ?
           AND alloc.destination_type = 'activity'
           AND alloc.destination_activity_id IS NOT NULL
           AND m.movement_type = 'income'
           AND m.deleted_at IS NULL
         GROUP BY alloc.destination_activity_id
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
           alloc.destination_activity_id AS activity_id,
           SUM(alloc.amount) AS collected_amount
         FROM saas_neon_movement_allocations alloc
         INNER JOIN saas_neon_movements m
           ON m.id = alloc.movement_id
          AND m.tenant_id = alloc.tenant_id
         WHERE alloc.tenant_id = ?
           AND alloc.destination_type = 'activity'
           AND alloc.destination_activity_id IS NOT NULL
           AND m.movement_type = 'income'
           AND m.deleted_at IS NULL
         GROUP BY alloc.destination_activity_id
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

  private async findExpenseRowWithConnection(connection: PoolConnection, tenantId: number, movementId: number) {
    const [rows] = await connection.query<NeonExpenseRow[]>(
      `SELECT
         m.id,
         m.tenant_id,
         m.movement_date,
         m.account_id,
         a.name AS account_name,
         m.category_id,
         c.name AS category_name,
         c.classification AS category_classification,
         m.total_amount,
         m.description,
         alloc.destination_type,
         alloc.destination_activity_id,
         CASE
           WHEN alloc.destination_activity_id IS NULL THEN NULL
           ELSE CONCAT('#', act.activity_number, '/', act.activity_year)
         END AS destination_activity_code,
         act.description AS destination_activity_description,
         alloc.destination_label,
         m.created_at,
         m.updated_at
       FROM saas_neon_movements m
       INNER JOIN saas_neon_accounts a
         ON a.id = m.account_id
        AND a.tenant_id = m.tenant_id
       INNER JOIN saas_neon_categories c
         ON c.id = m.category_id
        AND c.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_movement_allocations alloc
         ON alloc.movement_id = m.id
        AND alloc.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_activities act
         ON act.id = alloc.destination_activity_id
        AND act.tenant_id = alloc.tenant_id
       WHERE m.id = ?
         AND m.tenant_id = ?
         AND m.movement_type = 'expense'
         AND m.deleted_at IS NULL
       LIMIT 1`,
      [movementId, tenantId]
    );

    if (!rows[0]) {
      throw new BadRequestException("Gasto no encontrado para este tenant");
    }

    return rows[0];
  }

  private async findJournalRowsWithConnection(connection: PoolConnection, tenantId: number, movementId: number) {
    const [rows] = await connection.query<NeonJournalRow[]>(
      `SELECT
         m.id,
         m.tenant_id,
         m.movement_type,
         m.movement_date,
         m.account_id,
         a.name AS account_name,
         m.total_amount,
         m.description,
         m.provider_name,
         m.document_ref,
         m.quantity,
         m.unit_label,
         m.currency_code,
         m.expense_kind,
         m.credit_card_label,
         m.due_date,
         m.source_type,
         m.source_activity_id,
         CASE
           WHEN src_act.id IS NULL THEN NULL
           ELSE CONCAT('#', src_act.activity_number, '/', src_act.activity_year)
         END AS source_activity_code,
         src_act.description AS source_activity_description,
         alloc.id AS allocation_id,
         alloc.destination_type,
         alloc.destination_activity_id,
         CASE
           WHEN alloc_act.id IS NULL THEN NULL
           ELSE CONCAT('#', alloc_act.activity_number, '/', alloc_act.activity_year)
         END AS destination_activity_code,
         alloc_act.description AS destination_activity_description,
         alloc.destination_label,
         alloc.amount AS allocation_amount,
         CAST(alloc.metadata_json AS CHAR) AS allocation_metadata_json,
         m.created_at,
         m.updated_at
       FROM saas_neon_movements m
       INNER JOIN saas_neon_accounts a
         ON a.id = m.account_id
        AND a.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_activities src_act
         ON src_act.id = m.source_activity_id
        AND src_act.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_movement_allocations alloc
         ON alloc.movement_id = m.id
        AND alloc.tenant_id = m.tenant_id
       LEFT JOIN saas_neon_activities alloc_act
         ON alloc_act.id = alloc.destination_activity_id
        AND alloc_act.tenant_id = alloc.tenant_id
       WHERE m.id = ?
         AND m.tenant_id = ?
         AND m.deleted_at IS NULL
       ORDER BY alloc.id ASC`,
      [movementId, tenantId]
    );

    if (!rows[0]) {
      throw new BadRequestException("Movimiento no encontrado para este tenant");
    }

    return rows;
  }

  private async listActivityPayments(tenantId: number, activityId: number) {
    const rows = await this.databaseService.query<NeonActivityPaymentRow[]>(
      `SELECT
         alloc.id,
         alloc.tenant_id,
         alloc.destination_activity_id AS activity_id,
         alloc.movement_id,
         m.account_id,
         a.name AS account_name,
         m.movement_date AS payment_date,
         alloc.amount AS paid_amount,
         m.description,
         alloc.created_at
       FROM saas_neon_movement_allocations alloc
       INNER JOIN saas_neon_movements m
         ON m.id = alloc.movement_id
        AND m.tenant_id = alloc.tenant_id
       INNER JOIN saas_neon_accounts a
         ON a.id = m.account_id
        AND a.tenant_id = m.tenant_id
       WHERE alloc.tenant_id = ?
         AND alloc.destination_type = 'activity'
         AND alloc.destination_activity_id = ?
         AND m.movement_type = 'income'
         AND m.deleted_at IS NULL
       ORDER BY m.movement_date DESC, alloc.id DESC`,
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

  private mapCategory(row: NeonCategoryRow | undefined): NeonCategory {
    if (!row) {
      throw new BadRequestException("Categoria no encontrada");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      movementType: row.movement_type,
      classification: row.classification,
      isSystem: Boolean(row.is_system),
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

    const quotedAmount = Number(row.quoted_amount);
    const collectedAmount = Number(row.collected_amount);
    const pendingAmount = Number(row.pending_amount);

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
      commercialStatus: this.deriveActivityCommercialStatus(row.commercial_status, quotedAmount, collectedAmount, pendingAmount),
      quotedAmount,
      collectedAmount,
      pendingAmount,
      payments,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapExpense(row: NeonExpenseRow | undefined): NeonExpense {
    if (!row) {
      throw new BadRequestException("Gasto no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      movementDate: row.movement_date,
      accountId: row.account_id,
      accountName: row.account_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryClassification: row.category_classification,
      totalAmount: Number(row.total_amount),
      description: row.description,
      destinationType: row.destination_type,
      destinationActivityId: row.destination_activity_id,
      destinationActivityCode: row.destination_activity_code,
      destinationActivityDescription: row.destination_activity_description,
      destinationLabel: row.destination_label,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapJournalEntries(rows: NeonJournalRow[]): NeonJournalEntry[] {
    const items = new Map<number, NeonJournalEntry>();

    for (const row of rows) {
      if (!items.has(row.id)) {
        items.set(row.id, {
          id: row.id,
          tenantId: row.tenant_id,
          movementType: row.movement_type,
          movementDate: row.movement_date,
          accountId: row.account_id,
          accountName: row.account_name,
          totalAmount: Number(row.total_amount),
          description: row.description,
          providerName: row.provider_name,
          documentRef: row.document_ref,
          quantity: row.quantity === null ? null : Number(row.quantity),
          unitLabel: row.unit_label,
          currencyCode: row.currency_code,
          expenseKind: row.expense_kind,
          creditCardLabel: row.credit_card_label,
          dueDate: row.due_date,
          sourceType: row.source_type,
          sourceActivityId: row.source_activity_id,
          sourceActivityCode: row.source_activity_code,
          sourceActivityDescription: row.source_activity_description,
          allocations: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      }

      const entry = items.get(row.id)!;
      if (row.allocation_id) {
        entry.allocations.push(this.mapJournalAllocation(row));
      }
    }

    return Array.from(items.values());
  }

  private mapJournalAllocation(row: NeonJournalRow): NeonJournalAllocation {
    return {
      id: row.allocation_id || 0,
      destinationType: row.destination_type || "other",
      destinationActivityId: row.destination_activity_id,
      destinationActivityCode: row.destination_activity_code,
      destinationActivityDescription: row.destination_activity_description,
      destinationLabel: row.destination_label,
      amount: Number(row.allocation_amount || 0),
      metadata: this.parseAllocationMetadata(row.allocation_metadata_json)
    };
  }

  private parseAllocationMetadata(raw: string | null): Record<string, unknown> | null {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeStoredCommercialStatus(status: NeonCommercialStatus) {
    if (status === "facturado") {
      return "pendiente_de_cobrar" as const;
    }

    return status;
  }

  private deriveActivityCommercialStatus(
    storedStatus: NeonCommercialStatus,
    quotedAmount: number,
    collectedAmount: number,
    pendingAmount: number
  ): NeonCommercialStatus {
    if (quotedAmount > 0 && collectedAmount > 0 && pendingAmount <= 0) {
      return "cobrado";
    }

    if (storedStatus === "pendiente_de_facturar" && collectedAmount <= 0) {
      return "pendiente_de_facturar";
    }

    if (storedStatus === "pendiente_de_facturar" && collectedAmount > 0) {
      return pendingAmount <= 0 ? "cobrado" : "pendiente_de_cobrar";
    }

    if (storedStatus === "cobrado" && pendingAmount > 0) {
      return "pendiente_de_cobrar";
    }

    if (storedStatus === "pendiente_de_cobrar" || storedStatus === "facturado") {
      return pendingAmount <= 0 && collectedAmount > 0 ? "cobrado" : "pendiente_de_cobrar";
    }

    return storedStatus;
  }
}
