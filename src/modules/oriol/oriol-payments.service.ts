import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateOriolPaymentDto } from "./dto/create-oriol-payment.dto";
import { nowMysqlDateTime, toIsoString } from "./oriol.dateUtils";
import { OriolPayment } from "./oriol.types";

type OriolPaymentRow = RowDataPacket & {
  id: number;
  valor: string | number;
  detalle: string;
  fecha: string | Date;
};

// Pagos a proveedores/gastos del dia (saas_oriol_pagos) -- no confundir con
// los pagos de deuda de clientes a credito (saas_oriol_pagos_credito, en
// OriolSalesService), son dos cosas distintas.
@Injectable()
export class OriolPaymentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPayments(): Promise<{ items: OriolPayment[] }> {
    const rows = await this.databaseService.query<OriolPaymentRow[]>(`SELECT * FROM saas_oriol_pagos ORDER BY fecha DESC`);
    return { items: rows.map((row) => this.mapPayment(row)) };
  }

  async createPayment(dto: CreateOriolPaymentDto): Promise<{ item: OriolPayment }> {
    const fecha = nowMysqlDateTime();
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_pagos (valor, detalle, fecha) VALUES (?, ?, ?)`,
      [dto.valor, dto.detalle.trim(), fecha]
    );
    const rows = await this.databaseService.query<OriolPaymentRow[]>(`SELECT * FROM saas_oriol_pagos WHERE id = ? LIMIT 1`, [
      result.insertId
    ]);
    return { item: this.mapPayment(rows[0]) };
  }

  private mapPayment(row: OriolPaymentRow): OriolPayment {
    return {
      id: row.id,
      valor: Number(row.valor),
      detalle: row.detalle,
      fecha: toIsoString(row.fecha)
    };
  }
}
