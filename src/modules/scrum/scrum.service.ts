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
  created_at: Date | string;
  updated_at: Date | string;
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

@Injectable()
export class ScrumService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async getWorkspace() {
    await this.ensureTables();
    await this.ensureDailyTasksForToday();

    const [tasks, clients] = await Promise.all([this.listTasks(), this.listClients()]);

    return {
      ok: true,
      tasks,
      clients
    };
  }

  async createTask(dto: CreateScrumTaskDto) {
    await this.ensureTables();
    const isDailyTask = dto.difficulty === "blue";
    const today = getMontevideoDateKey(new Date());
    const dailyTaskKey = isDailyTask ? `daily-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` : null;

    const estimatedMinutes = Number.isFinite(dto.estimatedMinutes) ? Math.max(0, Math.round(dto.estimatedMinutes || 0)) : 0;

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_scrum_tasks (
         title,
         description,
         estimated_minutes,
         difficulty,
         daily_task_key,
         task_day,
         status,
         started_at,
         completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'todo', NULL, NULL)`,
      [
        dto.title.trim(),
        dto.description?.trim() || null,
        estimatedMinutes,
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

  private async ensureDailyTasksForToday() {
    const today = getMontevideoDateKey(new Date());
    const rows = await this.databaseService.query<
      Array<
        RowDataPacket & {
          daily_task_key: string;
          title: string;
          description: string | null;
          estimated_minutes: number;
          latest_task_day: Date | string;
        }
      >
    >(
      `SELECT
         daily_task_key,
         title,
         description,
         estimated_minutes,
         MAX(task_day) AS latest_task_day
       FROM saas_scrum_tasks
       WHERE daily_task_key IS NOT NULL
       GROUP BY daily_task_key, title, description, estimated_minutes`
    );

    for (const row of rows) {
      if (toDateOnly(row.latest_task_day) >= today) {
        continue;
      }

      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_scrum_tasks (
           title,
           description,
           estimated_minutes,
           difficulty,
           daily_task_key,
           task_day,
           status,
           started_at,
           completed_at
         ) VALUES (?, ?, ?, 'blue', ?, ?, 'todo', NULL, NULL)`,
        [row.title, row.description, Number(row.estimated_minutes), row.daily_task_key, today]
      );
    }
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
  }
}
