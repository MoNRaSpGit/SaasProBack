import { BadRequestException, Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { UpdateQqDiscountConfigDto } from "./dto/update-qq-discount-config.dto";
import { QqDiscountConfig } from "./qq.types";

type QqDiscountConfigRow = RowDataPacket & {
  code: string;
  percentage: number;
  enabled: number;
  extra_codes: string | null;
};

// Codigo de descuento (28/09/2026, pedido explicito): configurable por el
// admin desde su propia pestaña. 23/11/2026: hasta 5 codigos en total (el
// principal + 4 extra, uno por vendedor) para saber de quien fue la venta;
// el codigo usado sale en el WhatsApp. Ver publico (GET) para que el carrito
// sepa si mostrar el input, y privado (PATCH, solo admin) para cambiarlo --
// mismo criterio que carrusel/productos en qq.controller.ts.
@Injectable()
export class QqDiscountService {
  constructor(private readonly databaseService: DatabaseService) {}

  private parseExtra(raw: string | null): { code: string; percentage: number }[] {
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is { code: string; percentage: number } => typeof item?.code === "string" && Number.isFinite(Number(item?.percentage)))
        .map((item) => ({ code: item.code, percentage: Number(item.percentage) }));
    } catch {
      return [];
    }
  }

  async getConfig(): Promise<{ item: QqDiscountConfig }> {
    const rows = await this.databaseService.query<QqDiscountConfigRow[]>(
      `SELECT code, percentage, enabled, extra_codes FROM saas_qq_discount_config WHERE id = 1 LIMIT 1`
    );
    const row = rows[0];
    return {
      item: row
        ? { code: row.code, percentage: Number(row.percentage), enabled: Boolean(row.enabled), extraCodes: this.parseExtra(row.extra_codes) }
        : { code: "", percentage: 10, enabled: false, extraCodes: [] }
    };
  }

  async updateConfig(dto: UpdateQqDiscountConfigDto): Promise<{ item: QqDiscountConfig }> {
    const extra = (dto.extraCodes ?? [])
      .map((item) => ({ code: item.code.trim(), percentage: item.percentage }))
      .filter((item) => item.code);

    // Un codigo repetido (sin distinguir mayusculas) no se podria saber de quien es.
    const all = [dto.code.trim(), ...extra.map((item) => item.code)].filter(Boolean).map((code) => code.toLowerCase());
    if (new Set(all).size !== all.length) {
      throw new BadRequestException("Hay códigos repetidos: cada vendedor tiene que tener uno distinto.");
    }

    await this.databaseService.execute(
      `INSERT INTO saas_qq_discount_config (id, code, percentage, enabled, extra_codes)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE code = VALUES(code), percentage = VALUES(percentage), enabled = VALUES(enabled), extra_codes = VALUES(extra_codes)`,
      [dto.code.trim(), dto.percentage, dto.enabled ? 1 : 0, JSON.stringify(extra)]
    );
    return this.getConfig();
  }
}
