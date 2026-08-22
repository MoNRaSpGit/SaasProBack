import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateScrumClientDto } from "./dto/create-scrum-client.dto";
import { CreateScrumDebtDto } from "./dto/create-scrum-debt.dto";
import { CreateScrumDebtChargeDto } from "./dto/create-scrum-debt-charge.dto";
import { CreateScrumDebtPaymentDto } from "./dto/create-scrum-debt-payment.dto";
import { CreateScrumTaskDto } from "./dto/create-scrum-task.dto";
import { RegisterScrumClientDebtPaymentDto } from "./dto/register-scrum-client-debt-payment.dto";
import { UpdateScrumClientDto } from "./dto/update-scrum-client.dto";
import { UpdateScrumDebtDto } from "./dto/update-scrum-debt.dto";
import { UpdateScrumTaskDifficultyDto } from "./dto/update-scrum-task-difficulty.dto";
import { UpdateScrumTaskDurationDto } from "./dto/update-scrum-task-duration.dto";
import { UpdateScrumTaskStatusDto } from "./dto/update-scrum-task-status.dto";

type ScrumTaskRow = RowDataPacket & {
  id: number;
  title: string;
  description: string | null;
  estimated_minutes: number;
  duration_unit: "days" | "weeks" | "months";
  duration_value: number;
  difficulty: "green" | "yellow" | "red" | "blue";
  daily_task_key: string | null;
  task_day: Date | string;
  status: "todo" | "in_progress" | "done";
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ScrumClientRow = RowDataPacket & {
  id: number;
  name: string;
  amount: string | number;
  frequency: "monthly" | "semiannual";
  next_payment_at: Date | string;
  debt_amount: string | number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ScrumClientDebtPaymentRow = RowDataPacket & {
  id: number;
  client_id: number;
  amount: string | number;
  paid_at: Date | string;
};

type ScrumDebtRow = RowDataPacket & {
  id: number;
  name: string;
  initial_amount: string | number;
  due_date: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

type ScrumDebtChargeRow = RowDataPacket & {
  id: number;
  debt_id: number;
  amount: string | number;
  detail: string;
  charged_at: Date | string;
};

type ScrumDebtPaymentRow = RowDataPacket & {
  id: number;
  debt_id: number;
  amount: string | number;
  paid_at: Date | string;
};

type ScrumClientAmountChangeRow = RowDataPacket & {
  id: number;
  client_id: number;
  previous_amount: string | number;
  new_amount: string | number;
  description: string;
  changed_at: Date | string;
};

function toDateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function getMontevideoDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addBillingCycle(dateValue: string, frequency: "monthly" | "semiannual") {
  const nextDate = new Date(`${dateValue}T00:00:00.000Z`);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + (frequency === "monthly" ? 1 : 6));
  return nextDate.toISOString().slice(0, 10);
}

function addMonths(dateValue: string, months: number) {
  const nextDate = new Date(`${dateValue}T00:00:00.000Z`);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate.toISOString().slice(0, 10);
}

function normalizeTaskDuration(durationUnit?: "days" | "weeks" | "months", durationValue?: number) {
  const safeUnit = durationUnit || "days";
  const safeValue = Number.isFinite(durationValue) ? Math.max(1, Math.round(durationValue || 1)) : 1;

  if (safeUnit === "days" && safeValue > 6) {
    throw new BadRequestException("Los dias no pueden superar 6. Usa semanas.");
  }

  if (safeUnit === "weeks" && safeValue > 4) {
    throw new BadRequestException("Las semanas no pueden superar 4. Usa meses.");
  }

  return {
    durationUnit: safeUnit,
    durationValue: safeValue
  };
}

@Injectable()
export class ScrumService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async getWorkspace() {
    await this.ensureTables();
    await this.ensureDailyTasksForToday();

    const [tasks, clients, debts] = await Promise.all([this.listTasks(), this.listClients(), this.listDebts()]);

    return {
      ok: true,
      tasks,
      clients,
      debts
    };
  }

  async createTask(dto: CreateScrumTaskDto) {
    await this.ensureTables();
    const isDailyTask = dto.difficulty === "blue";
    const today = getMontevideoDateKey(new Date());
    const dailyTaskKey = isDailyTask ? `daily-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` : null;
    const duration = normalizeTaskDuration(dto.durationUnit, dto.durationValue);

    const estimatedMinutes = Number.isFinite(dto.estimatedMinutes) ? Math.max(0, Math.round(dto.estimatedMinutes || 0)) : 0;

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_tasks (
         title,
         description,
         estimated_minutes,
         duration_unit,
         duration_value,
         difficulty,
         daily_task_key,
         task_day,
         status,
         started_at,
         completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', NULL, NULL)`,
      [
        dto.title.trim(),
        dto.description?.trim() || null,
        estimatedMinutes,
        duration.durationUnit,
        duration.durationValue,
        dto.difficulty,
        dailyTaskKey,
        today
      ]
    );

    return {
      ok: true,
      item: await this.getTaskById(Number(result.insertId))
    };
  }

  async updateTaskStatus(taskId: number, dto: UpdateScrumTaskStatusDto) {
    await this.ensureTables();
    await this.assertTaskExists(taskId);

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_scrum_tasks
       SET status = ?,
           started_at = ?,
           completed_at = ?
       WHERE id = ?`,
      [
        dto.status,
        dto.startedAt ? new Date(dto.startedAt) : null,
        dto.completedAt ? new Date(dto.completedAt) : null,
        taskId
      ]
    );

    return {
      ok: true,
      item: await this.getTaskById(taskId)
    };
  }

  async updateTaskDuration(taskId: number, dto: UpdateScrumTaskDurationDto) {
    await this.ensureTables();
    await this.assertTaskExists(taskId);
    const duration = normalizeTaskDuration(dto.durationUnit, dto.durationValue);

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_scrum_tasks
       SET duration_unit = ?,
           duration_value = ?
       WHERE id = ?`,
      [duration.durationUnit, duration.durationValue, taskId]
    );

    return {
      ok: true,
      item: await this.getTaskById(taskId)
    };
  }

  async updateTaskDifficulty(taskId: number, dto: UpdateScrumTaskDifficultyDto) {
    await this.ensureTables();
    await this.assertTaskExists(taskId);

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_scrum_tasks
       SET difficulty = ?
       WHERE id = ?`,
      [dto.difficulty, taskId]
    );

    return {
      ok: true,
      item: await this.getTaskById(taskId)
    };
  }

  async deleteTask(taskId: number) {
    await this.ensureTables();
    const currentTask = await this.getTaskById(taskId);

    if (currentTask.dailyTaskKey) {
      await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_scrum_tasks WHERE daily_task_key = ?`, [
        currentTask.dailyTaskKey
      ]);
      return { ok: true };
    }

    await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_scrum_tasks WHERE id = ?`, [taskId]);

    return { ok: true };
  }

  async createClient(dto: CreateScrumClientDto) {
    await this.ensureTables();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_clients (
         name,
         amount,
         frequency,
         next_payment_at,
         debt_amount
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        dto.name.trim(),
        Math.round(dto.amount),
        dto.frequency,
        dto.nextPaymentAt,
        dto.debtAmount !== undefined ? Math.round(dto.debtAmount) : null
      ]
    );

    return {
      ok: true,
      item: await this.getClientById(Number(result.insertId))
    };
  }

  async updateClient(clientId: number, dto: UpdateScrumClientDto) {
    await this.ensureTables();
    const currentClient = await this.getClientById(clientId);

    const nextName = dto.name?.trim() || currentClient.name;
    const nextAmount = dto.amount ?? currentClient.amount;
    const nextFrequency = dto.frequency ?? currentClient.frequency;
    const nextPaymentAt = dto.nextPaymentAt ?? currentClient.nextPaymentAt;

    const amountChanged = dto.amount !== undefined && Math.round(dto.amount) !== Math.round(currentClient.amount);
    if (amountChanged && !dto.amountChangeDescription?.trim()) {
      throw new BadRequestException("Agrega una descripcion para el cambio de monto.");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_scrum_clients
       SET name = ?, amount = ?, frequency = ?, next_payment_at = ?
       WHERE id = ?`,
      [nextName, Math.round(nextAmount), nextFrequency, nextPaymentAt, clientId]
    );

    if (amountChanged) {
      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_scrum_client_amount_changes (client_id, previous_amount, new_amount, description)
         VALUES (?, ?, ?, ?)`,
        [clientId, Math.round(currentClient.amount), Math.round(nextAmount), dto.amountChangeDescription!.trim()]
      );
    }

    return {
      ok: true,
      item: await this.getClientById(clientId)
    };
  }

  async registerClientPayment(clientId: number) {
    await this.ensureTables();
    const currentClient = await this.getClientById(clientId);
    const nextPaymentAt = addBillingCycle(currentClient.nextPaymentAt, currentClient.frequency);

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_scrum_clients
       SET next_payment_at = ?
       WHERE id = ?`,
      [nextPaymentAt, clientId]
    );

    return {
      ok: true,
      item: await this.getClientById(clientId)
    };
  }

  async registerClientDebtPayment(clientId: number, dto: RegisterScrumClientDebtPaymentDto) {
    await this.ensureTables();
    const currentClient = await this.getClientById(clientId);

    if (currentClient.debtAmount === null) {
      throw new BadRequestException("Este cliente no tiene deuda cargada.");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_client_debt_payments (client_id, amount) VALUES (?, ?)`,
      [clientId, dto.amount]
    );

    return {
      ok: true,
      item: await this.getClientById(clientId)
    };
  }

  async deleteClient(clientId: number) {
    await this.ensureTables();
    await this.assertClientExists(clientId);

    await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_scrum_clients WHERE id = ?`, [clientId]);

    return { ok: true };
  }

  async createDebt(dto: CreateScrumDebtDto) {
    await this.ensureTables();

    const dueDate = dto.dueDate || addMonths(toDateOnly(new Date()), 1);

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_debts (name, initial_amount, due_date) VALUES (?, ?, ?)`,
      [dto.name.trim(), Math.round(dto.amount * 100) / 100, dueDate]
    );

    return {
      ok: true,
      item: await this.getDebtById(Number(result.insertId))
    };
  }

  async updateDebt(debtId: number, dto: UpdateScrumDebtDto) {
    await this.ensureTables();
    const currentDebt = await this.getDebtById(debtId);

    const nextName = dto.name?.trim() || currentDebt.name;
    const nextDueDate = dto.dueDate ?? currentDebt.dueDate;

    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_scrum_debts SET name = ?, due_date = ? WHERE id = ?`, [
      nextName,
      nextDueDate,
      debtId
    ]);

    return {
      ok: true,
      item: await this.getDebtById(debtId)
    };
  }

  async addDebtCharge(debtId: number, dto: CreateScrumDebtChargeDto) {
    await this.ensureTables();
    await this.assertDebtExists(debtId);

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_debt_charges (debt_id, amount, detail) VALUES (?, ?, ?)`,
      [debtId, Math.round(dto.amount * 100) / 100, dto.detail.trim()]
    );

    return {
      ok: true,
      item: await this.getDebtById(debtId)
    };
  }

  async addDebtPayment(debtId: number, dto: CreateScrumDebtPaymentDto) {
    await this.ensureTables();
    await this.assertDebtExists(debtId);

    await this.databaseService.execute<ResultSetHeader>(`INSERT INTO saas_scrum_debt_payments (debt_id, amount) VALUES (?, ?)`, [
      debtId,
      Math.round(dto.amount * 100) / 100
    ]);

    return {
      ok: true,
      item: await this.getDebtById(debtId)
    };
  }

  async deleteDebt(debtId: number) {
    await this.ensureTables();
    await this.assertDebtExists(debtId);

    await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_scrum_debts WHERE id = ?`, [debtId]);

    return { ok: true };
  }

  private async listDebts() {
    const rows = await this.databaseService.query<ScrumDebtRow[]>(
      `SELECT id, name, initial_amount, due_date, created_at, updated_at
       FROM saas_scrum_debts
       ORDER BY due_date ASC, id DESC`
    );

    if (!rows.length) {
      return [];
    }

    const [chargeRows, paymentRows] = await Promise.all([
      this.databaseService.query<ScrumDebtChargeRow[]>(
        `SELECT id, debt_id, amount, detail, charged_at FROM saas_scrum_debt_charges ORDER BY charged_at ASC, id ASC`
      ),
      this.databaseService.query<ScrumDebtPaymentRow[]>(
        `SELECT id, debt_id, amount, paid_at FROM saas_scrum_debt_payments ORDER BY paid_at ASC, id ASC`
      )
    ]);

    const chargesByDebtId = new Map<number, ScrumDebtChargeRow[]>();
    for (const chargeRow of chargeRows) {
      const debtId = Number(chargeRow.debt_id);
      const list = chargesByDebtId.get(debtId) ?? [];
      list.push(chargeRow);
      chargesByDebtId.set(debtId, list);
    }

    const paymentsByDebtId = new Map<number, ScrumDebtPaymentRow[]>();
    for (const paymentRow of paymentRows) {
      const debtId = Number(paymentRow.debt_id);
      const list = paymentsByDebtId.get(debtId) ?? [];
      list.push(paymentRow);
      paymentsByDebtId.set(debtId, list);
    }

    return rows.map((row) =>
      this.mapDebt(row, chargesByDebtId.get(Number(row.id)) ?? [], paymentsByDebtId.get(Number(row.id)) ?? [])
    );
  }

  private async getDebtById(debtId: number) {
    const rows = await this.databaseService.query<ScrumDebtRow[]>(
      `SELECT id, name, initial_amount, due_date, created_at, updated_at
       FROM saas_scrum_debts
       WHERE id = ?
       LIMIT 1`,
      [debtId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Debt not found");
    }

    const [chargeRows, paymentRows] = await Promise.all([
      this.databaseService.query<ScrumDebtChargeRow[]>(
        `SELECT id, debt_id, amount, detail, charged_at FROM saas_scrum_debt_charges WHERE debt_id = ? ORDER BY charged_at ASC, id ASC`,
        [debtId]
      ),
      this.databaseService.query<ScrumDebtPaymentRow[]>(
        `SELECT id, debt_id, amount, paid_at FROM saas_scrum_debt_payments WHERE debt_id = ? ORDER BY paid_at ASC, id ASC`,
        [debtId]
      )
    ]);

    return this.mapDebt(row, chargeRows, paymentRows);
  }

  private mapDebt(row: ScrumDebtRow, chargeRows: ScrumDebtChargeRow[], paymentRows: ScrumDebtPaymentRow[]) {
    const initialAmount = Number(row.initial_amount);
    const charges = chargeRows.map((chargeRow) => ({
      id: Number(chargeRow.id),
      amount: Number(chargeRow.amount),
      detail: chargeRow.detail,
      chargedAt: this.toIsoDateTime(chargeRow.charged_at)
    }));
    const payments = paymentRows.map((paymentRow) => ({
      id: Number(paymentRow.id),
      amount: Number(paymentRow.amount),
      paidAt: this.toIsoDateTime(paymentRow.paid_at)
    }));

    const totalCharged = Math.round((initialAmount + charges.reduce((sum, charge) => sum + charge.amount, 0)) * 100) / 100;
    const totalPaid = Math.round(payments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100;
    const remaining = Math.max(0, Math.round((totalCharged - totalPaid) * 100) / 100);

    return {
      id: Number(row.id),
      name: row.name,
      initialAmount,
      dueDate: toDateOnly(row.due_date),
      totalCharged,
      totalPaid,
      remaining,
      charges,
      payments
    };
  }

  private toIsoDateTime(value: Date | string) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private async assertDebtExists(debtId: number) {
    await this.getDebtById(debtId);
  }

  private async listTasks() {
    const rows = await this.databaseService.query<ScrumTaskRow[]>(
      `SELECT
         id,
         title,
         description,
         estimated_minutes,
         duration_unit,
         duration_value,
         difficulty,
         daily_task_key,
         task_day,
         status,
         started_at,
         completed_at,
         created_at,
         updated_at
       FROM saas_scrum_tasks
       ORDER BY
         FIELD(status, 'in_progress', 'todo', 'done'),
         id DESC`
    );

    return rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      description: row.description,
      estimatedMinutes: Number(row.estimated_minutes),
      createdAt: new Date(row.created_at).getTime(),
      durationUnit: row.duration_unit,
      durationValue: Number(row.duration_value),
      difficulty: row.difficulty,
      dailyTaskKey: row.daily_task_key,
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null
    }));
  }

  private async listClients() {
    const rows = await this.databaseService.query<ScrumClientRow[]>(
      `SELECT
         id,
         name,
         amount,
         frequency,
         next_payment_at,
         debt_amount,
         created_at,
         updated_at
       FROM saas_scrum_clients
       ORDER BY id DESC`
    );

    if (!rows.length) {
      return [];
    }

    const paymentRows = await this.databaseService.query<ScrumClientDebtPaymentRow[]>(
      `SELECT id, client_id, amount, paid_at
       FROM saas_scrum_client_debt_payments
       ORDER BY paid_at ASC, id ASC`
    );

    const paymentsByClientId = new Map<number, ScrumClientDebtPaymentRow[]>();
    for (const paymentRow of paymentRows) {
      const clientId = Number(paymentRow.client_id);
      const list = paymentsByClientId.get(clientId) ?? [];
      list.push(paymentRow);
      paymentsByClientId.set(clientId, list);
    }

    const amountChangeRows = await this.databaseService.query<ScrumClientAmountChangeRow[]>(
      `SELECT id, client_id, previous_amount, new_amount, description, changed_at
       FROM saas_scrum_client_amount_changes
       ORDER BY changed_at ASC, id ASC`
    );

    const amountChangesByClientId = new Map<number, ScrumClientAmountChangeRow[]>();
    for (const changeRow of amountChangeRows) {
      const clientId = Number(changeRow.client_id);
      const list = amountChangesByClientId.get(clientId) ?? [];
      list.push(changeRow);
      amountChangesByClientId.set(clientId, list);
    }

    return rows.map((row) =>
      this.mapClient(row, paymentsByClientId.get(Number(row.id)) ?? [], amountChangesByClientId.get(Number(row.id)) ?? [])
    );
  }

  private async getTaskById(taskId: number) {
    const rows = await this.databaseService.query<ScrumTaskRow[]>(
      `SELECT
         id,
         title,
         description,
         estimated_minutes,
         duration_unit,
         duration_value,
         difficulty,
         daily_task_key,
         task_day,
         status,
         started_at,
         completed_at,
         created_at,
         updated_at
       FROM saas_scrum_tasks
       WHERE id = ?
       LIMIT 1`,
      [taskId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Task not found");
    }

    return {
      id: Number(row.id),
      title: row.title,
      description: row.description,
      estimatedMinutes: Number(row.estimated_minutes),
      createdAt: new Date(row.created_at).getTime(),
      durationUnit: row.duration_unit,
      durationValue: Number(row.duration_value),
      difficulty: row.difficulty,
      dailyTaskKey: row.daily_task_key,
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null
    };
  }

  private async getClientById(clientId: number) {
    const rows = await this.databaseService.query<ScrumClientRow[]>(
      `SELECT
         id,
         name,
         amount,
         frequency,
         next_payment_at,
         debt_amount,
         created_at,
         updated_at
       FROM saas_scrum_clients
       WHERE id = ?
       LIMIT 1`,
      [clientId]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Client not found");
    }

    const paymentRows = await this.databaseService.query<ScrumClientDebtPaymentRow[]>(
      `SELECT id, client_id, amount, paid_at
       FROM saas_scrum_client_debt_payments
       WHERE client_id = ?
       ORDER BY paid_at ASC, id ASC`,
      [clientId]
    );

    const amountChangeRows = await this.databaseService.query<ScrumClientAmountChangeRow[]>(
      `SELECT id, client_id, previous_amount, new_amount, description, changed_at
       FROM saas_scrum_client_amount_changes
       WHERE client_id = ?
       ORDER BY changed_at ASC, id ASC`,
      [clientId]
    );

    return this.mapClient(row, paymentRows, amountChangeRows);
  }

  private mapClient(row: ScrumClientRow, paymentRows: ScrumClientDebtPaymentRow[], amountChangeRows: ScrumClientAmountChangeRow[]) {
    const debtAmount = row.debt_amount === null || row.debt_amount === undefined ? null : Number(row.debt_amount);
    const debtPayments = paymentRows.map((paymentRow) => ({
      id: Number(paymentRow.id),
      amount: Number(paymentRow.amount),
      paidAt: new Date(paymentRow.paid_at).toISOString()
    }));
    const debtPaidAmount = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const debtRemaining = debtAmount === null ? null : Math.max(0, Math.round((debtAmount - debtPaidAmount) * 100) / 100);

    const amountHistory = amountChangeRows.map((changeRow) => {
      const previousAmount = Number(changeRow.previous_amount);
      const newAmount = Number(changeRow.new_amount);
      return {
        id: Number(changeRow.id),
        previousAmount,
        newAmount,
        delta: Math.round((newAmount - previousAmount) * 100) / 100,
        description: changeRow.description,
        changedAt: new Date(changeRow.changed_at).toISOString()
      };
    });

    return {
      id: Number(row.id),
      name: row.name,
      amount: Number(row.amount),
      frequency: row.frequency,
      nextPaymentAt: toDateOnly(row.next_payment_at),
      debtAmount,
      debtPaidAmount,
      debtRemaining,
      debtPayments,
      amountHistory
    };
  }

  private async assertTaskExists(taskId: number) {
    await this.getTaskById(taskId);
  }

  private async assertClientExists(clientId: number) {
    await this.getClientById(clientId);
  }

  private async ensureDailyTasksForToday() {
    const today = getMontevideoDateKey(new Date());
    const rows = await this.databaseService.query<
      Array<
        RowDataPacket & {
          daily_task_key: string;
          title: string;
          description: string | null;
          estimated_minutes: number;
          duration_unit: "days" | "weeks" | "months";
          duration_value: number;
          task_day: Date | string;
          status: "todo" | "in_progress" | "done";
        }
      >
    >(
      `SELECT
         t1.daily_task_key,
         t1.title,
         t1.description,
         t1.estimated_minutes,
         t1.duration_unit,
         t1.duration_value,
         t1.task_day,
         t1.status
       FROM saas_scrum_tasks t1
       INNER JOIN (
         SELECT daily_task_key, MAX(id) AS latest_id
         FROM saas_scrum_tasks
         WHERE daily_task_key IS NOT NULL
         GROUP BY daily_task_key
       ) latest ON latest.daily_task_key = t1.daily_task_key AND latest.latest_id = t1.id`
    );

    for (const row of rows) {
      if (toDateOnly(row.task_day) >= today) {
        continue;
      }

      // Si la instancia de ayer quedo sin terminar, no se genera una nueva copia:
      // se deja tal cual esta hasta que el usuario la complete.
      if (row.status !== "done") {
        continue;
      }

      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_scrum_tasks (
           title,
           description,
           estimated_minutes,
           duration_unit,
           duration_value,
           difficulty,
           daily_task_key,
           task_day,
           status,
           started_at,
           completed_at
         ) VALUES (?, ?, ?, ?, ?, 'blue', ?, ?, 'todo', NULL, NULL)`,
        [
          row.title,
          row.description,
          Number(row.estimated_minutes),
          row.duration_unit,
          Number(row.duration_value),
          row.daily_task_key,
          today
        ]
      );
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
    await this.databaseService.execute(`DROP TABLE IF EXISTS saas_scrum_samples`);

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_tasks (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         title VARCHAR(180) NOT NULL,
         description VARCHAR(500) NULL,
         estimated_minutes INT UNSIGNED NOT NULL,
         duration_unit ENUM('days', 'weeks', 'months') NOT NULL DEFAULT 'days',
         duration_value INT UNSIGNED NOT NULL DEFAULT 1,
         difficulty ENUM('green', 'yellow', 'red', 'blue') NOT NULL,
         daily_task_key VARCHAR(80) NULL,
         task_day DATE NOT NULL,
         status ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
         started_at DATETIME NULL,
         completed_at DATETIME NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    const descriptionColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'saas_scrum_tasks'
         AND column_name = 'description'`
    );

    if (Number(descriptionColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(`ALTER TABLE saas_scrum_tasks ADD COLUMN description VARCHAR(500) NULL AFTER title`);
    }

    const durationUnitColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'saas_scrum_tasks'
         AND column_name = 'duration_unit'`
    );

    if (Number(durationUnitColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(
        `ALTER TABLE saas_scrum_tasks ADD COLUMN duration_unit ENUM('days', 'weeks', 'months') NOT NULL DEFAULT 'days' AFTER estimated_minutes`
      );
    }

    const durationValueColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'saas_scrum_tasks'
         AND column_name = 'duration_value'`
    );

    if (Number(durationValueColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(
        `ALTER TABLE saas_scrum_tasks ADD COLUMN duration_value INT UNSIGNED NOT NULL DEFAULT 1 AFTER duration_unit`
      );
    }

    const dailyTaskKeyColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'saas_scrum_tasks'
         AND column_name = 'daily_task_key'`
    );

    if (Number(dailyTaskKeyColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(
        `ALTER TABLE saas_scrum_tasks ADD COLUMN daily_task_key VARCHAR(80) NULL AFTER difficulty`
      );
    }

    const taskDayColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'saas_scrum_tasks'
         AND column_name = 'task_day'`
    );

    if (Number(taskDayColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(
        `ALTER TABLE saas_scrum_tasks ADD COLUMN task_day DATE NOT NULL DEFAULT '2026-07-06' AFTER daily_task_key`
      );
      await this.databaseService.execute(
        `UPDATE saas_scrum_tasks
         SET task_day = DATE(COALESCE(created_at, CURRENT_TIMESTAMP))
         WHERE task_day = '2026-07-06'`
      );
    }

    await this.databaseService.execute(
      `ALTER TABLE saas_scrum_tasks
       MODIFY COLUMN difficulty ENUM('green', 'yellow', 'red', 'blue') NOT NULL`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_clients (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         name VARCHAR(180) NOT NULL,
         amount DECIMAL(12, 2) NOT NULL,
         frequency ENUM('monthly', 'semiannual') NOT NULL,
         next_payment_at DATE NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    const debtAmountColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'saas_scrum_clients'
         AND column_name = 'debt_amount'`
    );

    if (Number(debtAmountColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(`ALTER TABLE saas_scrum_clients ADD COLUMN debt_amount DECIMAL(12, 2) NULL AFTER frequency`);
    }

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_client_debt_payments (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         client_id BIGINT UNSIGNED NOT NULL,
         amount DECIMAL(12, 2) NOT NULL,
         paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_scrum_client_debt_payments_client (client_id),
         CONSTRAINT fk_saas_scrum_client_debt_payments_client
           FOREIGN KEY (client_id) REFERENCES saas_scrum_clients (id)
           ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_client_amount_changes (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         client_id BIGINT UNSIGNED NOT NULL,
         previous_amount DECIMAL(12, 2) NOT NULL,
         new_amount DECIMAL(12, 2) NOT NULL,
         description VARCHAR(255) NOT NULL,
         changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_scrum_client_amount_changes_client (client_id),
         CONSTRAINT fk_saas_scrum_client_amount_changes_client
           FOREIGN KEY (client_id) REFERENCES saas_scrum_clients (id)
           ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_debts (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         name VARCHAR(180) NOT NULL,
         initial_amount DECIMAL(12, 2) NOT NULL,
         due_date DATE NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_debt_charges (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         debt_id BIGINT UNSIGNED NOT NULL,
         amount DECIMAL(12, 2) NOT NULL,
         detail VARCHAR(255) NOT NULL,
         charged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_scrum_debt_charges_debt (debt_id),
         CONSTRAINT fk_saas_scrum_debt_charges_debt
           FOREIGN KEY (debt_id) REFERENCES saas_scrum_debts (id)
           ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_scrum_debt_payments (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         debt_id BIGINT UNSIGNED NOT NULL,
         amount DECIMAL(12, 2) NOT NULL,
         paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_scrum_debt_payments_debt (debt_id),
         CONSTRAINT fk_saas_scrum_debt_payments_debt
           FOREIGN KEY (debt_id) REFERENCES saas_scrum_debts (id)
           ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}
