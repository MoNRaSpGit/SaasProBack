import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateScrumClientDto } from "./dto/create-scrum-client.dto";
import { CreateScrumTaskDto } from "./dto/create-scrum-task.dto";
import { UpdateScrumTaskStatusDto } from "./dto/update-scrum-task-status.dto";

type ScrumTaskRow = RowDataPacket & {
  id: number;
  title: string;
  description: string | null;
  estimated_minutes: number;
  difficulty: "green" | "yellow" | "red";
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
  created_at: Date | string;
  updated_at: Date | string;
};

function toDateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function addBillingCycle(dateValue: string, frequency: "monthly" | "semiannual") {
  const nextDate = new Date(`${dateValue}T00:00:00.000Z`);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + (frequency === "monthly" ? 1 : 6));
  return nextDate.toISOString().slice(0, 10);
}

@Injectable()
export class ScrumService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async getWorkspace() {
    await this.ensureTables();

    const [tasks, clients] = await Promise.all([this.listTasks(), this.listClients()]);

    return {
      ok: true,
      tasks,
      clients
    };
  }

  async createTask(dto: CreateScrumTaskDto) {
    await this.ensureTables();

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_tasks (
         title,
         description,
         estimated_minutes,
         difficulty,
         status,
         started_at,
         completed_at
       ) VALUES (?, ?, ?, ?, 'todo', NULL, NULL)`,
      [dto.title.trim(), dto.description?.trim() || null, Math.round(dto.estimatedMinutes), dto.difficulty]
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

  async deleteTask(taskId: number) {
    await this.ensureTables();
    await this.assertTaskExists(taskId);

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
         next_payment_at
       ) VALUES (?, ?, ?, ?)`,
      [dto.name.trim(), Math.round(dto.amount), dto.frequency, dto.nextPaymentAt]
    );

    return {
      ok: true,
      item: await this.getClientById(Number(result.insertId))
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

  async deleteClient(clientId: number) {
    await this.ensureTables();
    await this.assertClientExists(clientId);

    await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_scrum_clients WHERE id = ?`, [clientId]);

    return { ok: true };
  }

  private async listTasks() {
    const rows = await this.databaseService.query<ScrumTaskRow[]>(
      `SELECT
         id,
         title,
         description,
         estimated_minutes,
         difficulty,
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
      difficulty: row.difficulty,
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
         created_at,
         updated_at
       FROM saas_scrum_clients
       ORDER BY id DESC`
    );

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      amount: Number(row.amount),
      frequency: row.frequency,
      nextPaymentAt: toDateOnly(row.next_payment_at)
    }));
  }

  private async getTaskById(taskId: number) {
    const rows = await this.databaseService.query<ScrumTaskRow[]>(
      `SELECT
         id,
         title,
         description,
         estimated_minutes,
         difficulty,
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
      difficulty: row.difficulty,
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

    return {
      id: Number(row.id),
      name: row.name,
      amount: Number(row.amount),
      frequency: row.frequency,
      nextPaymentAt: toDateOnly(row.next_payment_at)
    };
  }

  private async assertTaskExists(taskId: number) {
    await this.getTaskById(taskId);
  }

  private async assertClientExists(clientId: number) {
    await this.getClientById(clientId);
  }

  private async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables();
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
         difficulty ENUM('green', 'yellow', 'red') NOT NULL,
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
  }
}
