// Fechas para el Panel de control de Gaby (24/09/2026): dia calendario
// completo (00:00 a 24:00), hora Montevideo -- a diferencia de El Joker,
// Gaby no tiene un "dia comercial" que arranca mas tarde que
// medianoche, asi que no hace falta el corrimiento extra de
// STORE_DAY_START_HOUR que usa joker.dateUtils.ts. Logica pura (sin DB).
import { BadRequestException } from "@nestjs/common";

const MONTEVIDEO_UTC_OFFSET_HOURS = 3;
// 07/11/2026 (pedido explicito): el Panel de Gaby se reinicia a la 01:00 en
// vez de a medianoche, porque el local cierra a las 00:00 y se le da una
// hora de margen. El "dia" de Gaby va de 01:00 a 01:00 (hora Montevideo).
const PANEL_DAY_START_HOUR = 1;

export function getTodayDateLabel(date = new Date()): string {
  // Antes de la 01:00 todavia cuenta como el dia anterior.
  const shifted = new Date(date.getTime() - PANEL_DAY_START_HOUR * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(shifted);
}

export function buildDayRangeUtc(dateLabel: string): { startIso: string; endIso: string } {
  const match = String(dateLabel || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new BadRequestException("La fecha debe tener formato YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const start = new Date(Date.UTC(year, month - 1, day, MONTEVIDEO_UTC_OFFSET_HOURS + PANEL_DAY_START_HOUR, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, MONTEVIDEO_UTC_OFFSET_HOURS + PANEL_DAY_START_HOUR, 0, 0));

  return {
    startIso: start.toISOString().slice(0, 19).replace("T", " "),
    endIso: end.toISOString().slice(0, 19).replace("T", " ")
  };
}
