import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { UpdateQqDiscountConfigDto } from "./dto/update-qq-discount-config.dto";
import { QqDiscountConfig } from "./qq.types";

type QqDiscountConfigRow = RowDataPacket & {
  code: string;
  percentage: number;
  enabled: number;
};

// Codigo de descuento (28/09/2026, pedido explicito): un solo codigo
// activo a la vez, configurable por el admin desde su propia pestaña.
// Ver publico (GET) para que el carrito sepa si mostrar el input, y
// privado (PATCH, solo admin) para cambiarlo -- mismo criterio que
// carrusel/productos en qq.controller.ts.
@Injectable()
export class QqDiscountService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getConfig(): Promise<{ item: QqDiscountConfig }> {
    const rows = await this.databaseService.query<QqDiscountConfigRow[]>(
      `SELECT code, percentage, enabled FROM saas_qq_discount_config WHERE id = 1 LIMIT 1`
    );
    const row = rows[0];
    return {
      item: row
        ? { code: row.code, percentage: Number(row.percentage), enabled: Boolean(row.enabled) }
        : { code: "", percentage: 10, enabled: false }
    };
  }

  async updateConfig(dto: UpdateQqDiscountConfigDto): Promise<{ item: QqDiscountConfig }> {
    await this.databaseService.execute(
      `INSERT INTO saas_qq_discount_config (id, code, percentage, enabled)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE code = VALUES(code), percentage = VALUES(percentage), enabled = VALUES(enabled)`,
      [dto.code.trim(), dto.percentage, dto.enabled ? 1 : 0]
    );
    return this.getConfig();
  }
}
