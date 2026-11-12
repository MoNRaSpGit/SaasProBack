import { BadRequestException, Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { GABY_PROFIT_MARGIN_RATIO } from "./gaby.types";

// Pestana "Mes" de Gaby (misma idea que el Mes de El Joker): total del mes,
// semanas con sus dias e historico por mes. El "dia" de Gaby va de 01:00 a
// 01:00 (hora Montevideo = UTC-3), o sea que en UTC arranca a las 04:00:
// restandole 4 horas al created_at (UTC) cae en el dia correcto.
const DAY_SHIFT_HOURS = 4;
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export type GabyMonthDay = { fecha: string; diaSemana: string; total: number };
export type GabyMonthWeek = { numero: number; total: number; dias: GabyMonthDay[] };
export type GabyMonthSummary = {
  anio: number;
  mes: number;
  total: number;
  profitMarginRatio: number;
  semanas: GabyMonthWeek[];
};
export type GabyMonthHistoryItem = { anio: number; mes: number; total: number };

function toSqlUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function monthStartUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, DAY_SHIFT_HOURS, 0, 0));
}

@Injectable()
export class GabyReportsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMonthSummary(year: number, month: number): Promise<GabyMonthSummary> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException("Anio o mes invalido.");
    }

    const rows = await this.databaseService.query<Array<RowDataPacket & { day: string; total: string | number }>>(
      `SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL ${DAY_SHIFT_HOURS} HOUR), '%Y-%m-%d') AS day, SUM(total_amount) AS total
       FROM saas_gaby_sales
       WHERE status = 'confirmed' AND created_at >= ? AND created_at < ?
       GROUP BY day`,
      [toSqlUtc(monthStartUtc(year, month)), toSqlUtc(monthStartUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1))]
    );
    const totalsByDay = new Map(rows.map((row) => [row.day, Number(row.total)]));

    // Semana 1 = dias 1-7, 2 = 8-14, 3 = 15-21, 4 = 22 en adelante (igual que Joker).
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const weeks: GabyMonthWeek[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const number = Math.min(4, Math.ceil(day / 7));
      let week = weeks[weeks.length - 1];
      if (!week || week.numero !== number) {
        week = { numero: number, total: 0, dias: [] };
        weeks.push(week);
      }
      const fecha = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const total = totalsByDay.get(fecha) ?? 0;
      week.dias.push({ fecha, diaSemana: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()], total });
      week.total += total;
    }

    return {
      anio: year,
      mes: month,
      total: weeks.reduce((sum, week) => sum + week.total, 0),
      profitMarginRatio: GABY_PROFIT_MARGIN_RATIO,
      semanas: weeks
    };
  }

  // Ultimos N meses (el actual incluido), del mas viejo al mas nuevo.
  async getMonthHistory(count: number): Promise<{ items: GabyMonthHistoryItem[] }> {
    const months = Math.min(12, Math.max(1, Math.floor(count) || 6));
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 60 * 1000); // "ahora" en hora Montevideo, con el corte de la 01:00
    const items: GabyMonthHistoryItem[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      items.push({ anio: date.getUTCFullYear(), mes: date.getUTCMonth() + 1, total: 0 });
    }

    const first = items[0];
    const rows = await this.databaseService.query<Array<RowDataPacket & { ym: string; total: string | number }>>(
      `SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL ${DAY_SHIFT_HOURS} HOUR), '%Y-%m') AS ym, SUM(total_amount) AS total
       FROM saas_gaby_sales
       WHERE status = 'confirmed' AND created_at >= ?
       GROUP BY ym`,
      [toSqlUtc(monthStartUtc(first.anio, first.mes))]
    );
    const totalsByMonth = new Map(rows.map((row) => [row.ym, Number(row.total)]));
    for (const item of items) item.total = totalsByMonth.get(`${item.anio}-${String(item.mes).padStart(2, "0")}`) ?? 0;
    return { items };
  }
}
