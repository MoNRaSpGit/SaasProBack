// Fechas del "dia comercial" de El Joker (Montevideo, UTC-3, arranca y
// cierra a las 5am hora local en vez de medianoche) + helpers de
// mapeo de fecha genericos. Todo esto es logica pura (sin DB), asi que
// cualquier servicio de joker que la necesite la importa directo, sin
// tener que inyectar nada.
import { BadRequestException } from "@nestjs/common";

export const STORE_UTC_OFFSET_HOURS = 3;
export const STORE_DAY_START_HOUR = 5;
const STORE_DAY_SHIFT_HOURS = STORE_UTC_OFFSET_HOURS + STORE_DAY_START_HOUR;

export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function getStoreDateLabel(date = new Date()) {
  const shifted = new Date(date.getTime() - STORE_DAY_START_HOUR * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(shifted);
}

export function buildStoreDayRangeUtc(dateLabel: string) {
  const match = String(dateLabel || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new BadRequestException("La fecha debe tener formato YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const start = new Date(Date.UTC(year, month - 1, day, STORE_DAY_SHIFT_HOURS, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, STORE_DAY_SHIFT_HOURS, 0, 0));

  return {
    startIso: start.toISOString().slice(0, 19).replace("T", " "),
    endIso: end.toISOString().slice(0, 19).replace("T", " ")
  };
}

export function buildMonthRangeUtc(anio: number, mes: number): { startIso: string; endIso: string; daysInMonth: number } {
  const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const ultimoDia = `${anio}-${String(mes).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { startIso } = buildStoreDayRangeUtc(primerDia);
  const { endIso } = buildStoreDayRangeUtc(ultimoDia);
  return { startIso, endIso, daysInMonth };
}

// Rango del dia comercial anterior (el que acaba de terminar) -- usado por
// el cron de las 5am para cerrarlo.
export function buildPreviousStoreDayRangeUtc(): { startIso: string; endIso: string; fechaYMD: string } {
  const previousDayInstant = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fechaYMD = getStoreDateLabel(previousDayInstant);
  const { startIso, endIso } = buildStoreDayRangeUtc(fechaYMD);
  return { startIso, endIso, fechaYMD };
}

export function anioMesActualStore(): { anio: number; mes: number } {
  const [anio, mes] = getStoreDateLabel().split("-").map(Number);
  return { anio, mes };
}

export function toIsoDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}
