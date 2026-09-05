import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerAdminExpenseDto } from "./dto/create-joker-admin-expense.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerAdminExpense } from "./joker.types";

type JokerAdminExpenseRow = RowDataPacket & {
  id: number;
  description: string;
  amount: string | number;
  created_at: string | Date;
};

// Gastos del Administrador durante el turno (ver joker.types.ts). A
// diferencia de los movimientos de caja de un repartidor, no dependen de
// ningun courier -- son propios de la caja general.
@Injectable()
export class JokerAdminExpensesService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Gastos del turno actual (desde el ultimo cierre de caja), igual
  // criterio que listCurrentPeriodOrders sin repartidor -- ver
  // JokerOrdersService.
  async listCurrentPeriodExpenses(): Promise<{ items: JokerAdminExpense[] }> {
    const stateRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT last_closed_at FROM saas_joker_register_state WHERE id = 1 LIMIT 1`
    );
    const lastClosedAt = stateRows[0]?.last_closed_at ?? null;

    const rows = await this.databaseService.query<JokerAdminExpenseRow[]>(
      lastClosedAt
        ? `SELECT id, description, amount, created_at FROM saas_joker_admin_expenses WHERE created_at > ? ORDER BY created_at DESC`
        : `SELECT id, description, amount, created_at FROM saas_joker_admin_expenses ORDER BY created_at DESC`,
      lastClosedAt ? [lastClosedAt] : []
    );

    return { items: rows.map((row) => this.mapExpense(row)) };
  }

  async addExpense(dto: CreateJokerAdminExpenseDto): Promise<{ item: JokerAdminExpense }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_admin_expenses (description, amount) VALUES (?, ?)`,
      [dto.description.trim(), dto.amount]
    );

    const rows = await this.databaseService.query<JokerAdminExpenseRow[]>(
      `SELECT id, description, amount, created_at FROM saas_joker_admin_expenses WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapExpense(rows[0]) };
  }

  async deleteExpense(expenseId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_admin_expenses WHERE id = ?`,
      [expenseId]
    );
    if (!result.affectedRows) {
      throw new NotFoundException("Gasto no encontrado");
    }
    return { ok: true };
  }

  private mapExpense(row: JokerAdminExpenseRow): JokerAdminExpense {
    return {
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      createdAt: toIsoString(row.created_at)
    };
  }
}
