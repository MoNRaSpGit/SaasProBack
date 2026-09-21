import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateJokerPaymentAccountDto } from "./dto/create-joker-payment-account.dto";
import { UpdateJokerPaymentAccountDto } from "./dto/update-joker-payment-account.dto";
import { toIsoString } from "./joker.dateUtils";
import { JokerPaymentAccount } from "./joker.types";

type JokerPaymentAccountRow = RowDataPacket & {
  id: number;
  label: string;
  owner_name: string;
  account_info: string;
  sort_order: number;
  created_at: string | Date;
};

const COLUMNS = "id, label, owner_name, account_info, sort_order, created_at";

// Metodos de pago (20/09/2026, pedido explicito): listado corto de banco/
// billetera + numero de cuenta, para responder rapido por WhatsApp cuando
// preguntan "a que cuenta te hago la transferencia". Mismo patron simple
// que clientes (ver JokerAccountService.listClients/createClient/
// deleteClient), con update ademas porque acá si se pide poder editar.
@Injectable()
export class JokerPaymentAccountsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPaymentMethods(): Promise<{ items: JokerPaymentAccount[] }> {
    const rows = await this.databaseService.query<JokerPaymentAccountRow[]>(
      `SELECT ${COLUMNS} FROM saas_joker_payment_methods ORDER BY sort_order ASC, id ASC`
    );

    return { items: rows.map((row) => this.mapPaymentMethod(row)) };
  }

  async createPaymentMethod(dto: CreateJokerPaymentAccountDto): Promise<{ item: JokerPaymentAccount }> {
    const [{ nextOrder }] = await this.databaseService.query<Array<RowDataPacket & { nextOrder: number }>>(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM saas_joker_payment_methods`
    );

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_payment_methods (label, owner_name, account_info, sort_order) VALUES (?, ?, ?, ?)`,
      [dto.label.trim(), dto.ownerName.trim(), dto.accountInfo.trim(), nextOrder]
    );

    return this.getPaymentMethodById(result.insertId);
  }

  async updatePaymentMethod(id: number, dto: UpdateJokerPaymentAccountDto): Promise<{ item: JokerPaymentAccount }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_joker_payment_methods SET label = ?, owner_name = ?, account_info = ? WHERE id = ?`,
      [dto.label.trim(), dto.ownerName.trim(), dto.accountInfo.trim(), id]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Metodo de pago no encontrado");
    }

    return this.getPaymentMethodById(id);
  }

  async deletePaymentMethod(id: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_joker_payment_methods WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      throw new NotFoundException("Metodo de pago no encontrado");
    }

    return { ok: true };
  }

  private async getPaymentMethodById(id: number): Promise<{ item: JokerPaymentAccount }> {
    const rows = await this.databaseService.query<JokerPaymentAccountRow[]>(
      `SELECT ${COLUMNS} FROM saas_joker_payment_methods WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException("Metodo de pago no encontrado");
    }

    return { item: this.mapPaymentMethod(rows[0]) };
  }

  private mapPaymentMethod(row: JokerPaymentAccountRow): JokerPaymentAccount {
    return {
      id: Number(row.id),
      label: row.label,
      ownerName: row.owner_name,
      accountInfo: row.account_info,
      sortOrder: Number(row.sort_order),
      createdAt: toIsoString(row.created_at)
    };
  }
}
