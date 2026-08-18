import { Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { UpdateOriolConfigDto } from "./dto/update-oriol-config.dto";
import { UpdateOriolTasaDolarDto } from "./dto/update-oriol-tasa-dolar.dto";
import { OriolConfig } from "./oriol.types";

// Valor de respaldo si saas_oriol_config todavia no tiene fila (id=1) --
// en uso normal la tasa real vive en la DB (tasa_dolar, editable desde el
// Panel, ver updateTasaDolar). Solo se usa para el Panel (caja del dia,
// ganancia estimada); la deuda de clientes no convierte entre monedas
// (deuda / deudaDolares en OriolClient son saldos independientes).
export const TASA_DOLAR_RESPALDO = 40;

@Injectable()
export class OriolConfigService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getConfig(): Promise<OriolConfig> {
    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT cambio, tasa_dolar FROM saas_oriol_config WHERE id = 1`
    );
    return {
      cambio: Number(rows[0]?.cambio) || 0,
      tasaDolar: Number(rows[0]?.tasa_dolar) || TASA_DOLAR_RESPALDO
    };
  }

  async updateCambio(dto: UpdateOriolConfigDto): Promise<{ item: OriolConfig }> {
    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_config (id, cambio) VALUES (1, ?) ON DUPLICATE KEY UPDATE cambio = ?`,
      [dto.cambio, dto.cambio]
    );
    return this.getConfig().then((item) => ({ item }));
  }

  // Tasa de conversion dolar->pesos, editable a mano desde el Panel -- ya
  // no es una constante fija en el codigo. Solo se usa para calculos en
  // pesos del Panel (caja del dia, ganancia); la deuda de clientes no
  // convierte entre monedas (ver deuda / deudaDolares en OriolClient).
  async updateTasaDolar(dto: UpdateOriolTasaDolarDto): Promise<{ item: OriolConfig }> {
    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_config (id, tasa_dolar) VALUES (1, ?) ON DUPLICATE KEY UPDATE tasa_dolar = ?`,
      [dto.tasaDolar, dto.tasaDolar]
    );
    return this.getConfig().then((item) => ({ item }));
  }
}
