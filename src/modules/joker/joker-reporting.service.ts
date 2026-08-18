import { BadRequestException, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { UpdateJokerCierreDiaDto } from "./dto/update-joker-cierre-dia.dto";
import {
  DIAS_SEMANA,
  anioMesActualStore,
  buildMonthRangeUtc,
  buildPreviousStoreDayRangeUtc,
  getStoreDateLabel,
  toIsoDateOnly
} from "./joker.dateUtils";
import { JokerCierreDia, JokerMonthHistoryItem, JokerMonthSummary, JokerMonthWeek } from "./joker.types";

type JokerCierreDiaRow = RowDataPacket & {
  fecha: string | Date;
  total: string | number;
  editado_manualmente: number;
};

// ---------- Mes ----------
//
// A diferencia del resto del modulo (todo en vivo, sin cierre), "Mes" y la
// grafica usan el cierre diario congelado (saas_joker_cierres_diarios) como
// fuente de verdad para cualquier dia comercial que ya lo tenga -- solo cae
// a calcular en vivo desde saas_joker_orders para dias que todavia no se
// cerraron (tipicamente hoy, antes de que corra el cron de las 5am). El
// "dia" aca es siempre el dia comercial (5am a 5am, ver getStoreDateLabel),
// no el dia calendario.
@Injectable()
export class JokerReportingService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async getOrdersLiveByDay(startIso: string, endIso: string): Promise<Map<string, number>> {
    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT total, created_at FROM saas_joker_orders WHERE created_at >= ? AND created_at < ?`,
      [startIso, endIso]
    );
    const porDia = new Map<string, number>();
    for (const row of rows) {
      const clave = getStoreDateLabel(new Date(row.created_at as string));
      porDia.set(clave, (porDia.get(clave) ?? 0) + (Number(row.total) || 0));
    }
    return porDia;
  }

  private async getCierresPorDia(primerDia: string, ultimoDia: string): Promise<Map<string, number>> {
    const rows = await this.databaseService.query<JokerCierreDiaRow[]>(
      `SELECT fecha, total FROM saas_joker_cierres_diarios WHERE fecha BETWEEN ? AND ?`,
      [primerDia, ultimoDia]
    );
    const porDia = new Map<string, number>();
    for (const row of rows) {
      porDia.set(toIsoDateOnly(row.fecha), Number(row.total) || 0);
    }
    return porDia;
  }

  async getMonthSummary(anio: number, mes: number): Promise<JokerMonthSummary> {
    const { startIso, endIso, daysInMonth } = buildMonthRangeUtc(anio, mes);
    const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDia = `${anio}-${String(mes).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const [enVivoPorDia, cierresPorDia] = await Promise.all([
      this.getOrdersLiveByDay(startIso, endIso),
      this.getCierresPorDia(primerDia, ultimoDia)
    ]);

    const semanas: JokerMonthWeek[] = [];
    let semanaActual: JokerMonthWeek | null = null;

    for (let dia = 1; dia <= daysInMonth; dia++) {
      const numeroSemana = Math.min(4, Math.ceil(dia / 7));
      if (!semanaActual || semanaActual.numero !== numeroSemana) {
        semanaActual = { numero: numeroSemana, total: 0, dias: [] };
        semanas.push(semanaActual);
      }

      const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const cerrado = cierresPorDia.has(fecha);
      const total = cerrado ? cierresPorDia.get(fecha)! : (enVivoPorDia.get(fecha) ?? 0);
      const diaSemana = DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];

      semanaActual.dias.push({ fecha, diaSemana, total, cerrado });
      semanaActual.total += total;
    }

    const total = semanas.reduce((sum, semana) => sum + semana.total, 0);
    return { anio, mes, total, semanas };
  }

  async getMonthHistory(cantidad: number): Promise<{ items: JokerMonthHistoryItem[] }> {
    const cantidadMeses = Math.min(Math.max(cantidad, 1), 12);
    const { anio: anioActual, mes: mesActual } = anioMesActualStore();

    const meses: Array<{ anio: number; mes: number }> = [];
    let anio = anioActual;
    let mes = mesActual;
    for (let i = 0; i < cantidadMeses; i++) {
      meses.unshift({ anio, mes });
      mes -= 1;
      if (mes < 1) {
        mes = 12;
        anio -= 1;
      }
    }

    const { startIso } = buildMonthRangeUtc(meses[0].anio, meses[0].mes);
    const { endIso } = buildMonthRangeUtc(meses[meses.length - 1].anio, meses[meses.length - 1].mes);
    const primerDia = `${meses[0].anio}-${String(meses[0].mes).padStart(2, "0")}-01`;
    const ultimoMes = meses[meses.length - 1];
    const { daysInMonth: diasUltimoMes } = buildMonthRangeUtc(ultimoMes.anio, ultimoMes.mes);
    const ultimoDia = `${ultimoMes.anio}-${String(ultimoMes.mes).padStart(2, "0")}-${String(diasUltimoMes).padStart(2, "0")}`;

    const [enVivoPorDia, cierresPorDia] = await Promise.all([
      this.getOrdersLiveByDay(startIso, endIso),
      this.getCierresPorDia(primerDia, ultimoDia)
    ]);

    return {
      items: meses.map(({ anio: itemAnio, mes: itemMes }) => {
        const { daysInMonth } = buildMonthRangeUtc(itemAnio, itemMes);
        let total = 0;
        for (let dia = 1; dia <= daysInMonth; dia++) {
          const fecha = `${itemAnio}-${String(itemMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          total += cierresPorDia.get(fecha) ?? enVivoPorDia.get(fecha) ?? 0;
        }
        return { anio: itemAnio, mes: itemMes, total };
      })
    };
  }

  // Corre todos los dias a las 5am (hora Uruguay), cuando el local ya esta
  // cerrado del todo -- incluso si el ultimo cierre de caja cruzo la
  // medianoche -- y congela el total del dia comercial que acaba de
  // terminar. Si ese dia ya se habia corregido a mano (editarCierreDia),
  // no lo pisa -- el valor manual queda como fuente de verdad definitiva
  // para ese dia.
  @Cron("0 5 * * *", { timeZone: "America/Montevideo", name: "joker-cierre-diario" })
  async cerrarDiaAutomatico(): Promise<void> {
    const { startIso, endIso, fechaYMD } = buildPreviousStoreDayRangeUtc();

    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total), 0) AS total FROM saas_joker_orders WHERE created_at >= ? AND created_at < ?`,
      [startIso, endIso]
    );
    const total = Number(rows[0]?.total) || 0;

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_cierres_diarios (fecha, total)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         total = IF(editado_manualmente = 1, total, VALUES(total))`,
      [fechaYMD, total]
    );
  }

  // Correccion manual de un dia comercial ya cerrado (ej: se cargo un
  // pedido fuera del sistema y el cierre automatico quedo corto). Una vez
  // editado, el cron de las 5am ya no lo vuelve a tocar.
  async editarCierreDia(fecha: string, dto: UpdateJokerCierreDiaDto): Promise<{ item: JokerCierreDia }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException("Fecha invalida");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_joker_cierres_diarios (fecha, total, editado_manualmente)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         total = VALUES(total),
         editado_manualmente = 1`,
      [fecha, dto.total]
    );

    return { item: { fecha, total: dto.total, editadoManualmente: true } };
  }
}
