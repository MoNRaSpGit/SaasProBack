// Uruguay es UTC-3 todo el año (sin horario de verano). El reloj del
// server de MySQL no es confiable, asi que "hoy"/"este mes" se calculan
// siempre aca (Node), nunca con NOW()/CURDATE() del lado de la base --
// mismo criterio que joker.dateUtils.ts para su "store day". A diferencia
// de joker, el dia de oriol es el dia calendario comun (no hay corte a
// las 5am), por eso todo esto es mas simple: un solo offset fijo.
export const URUGUAY_UTC_OFFSET_HOURS = 3;

export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function buildTodayRangeUtc(): { startIso: string; endIso: string } {
  const uruguayNow = new Date(Date.now() - URUGUAY_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const year = uruguayNow.getUTCFullYear();
  const month = uruguayNow.getUTCMonth();
  const day = uruguayNow.getUTCDate();

  const start = new Date(Date.UTC(year, month, day, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
  const end = new Date(Date.UTC(year, month, day + 1, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
  return { startIso: toMysqlDateTime(start), endIso: toMysqlDateTime(end) };
}

export function buildMonthRangeUtc(anio: number, mes: number): { startIso: string; endIso: string; daysInMonth: number } {
  const start = new Date(Date.UTC(anio, mes - 1, 1, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
  const end = new Date(Date.UTC(anio, mes, 1, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
  const daysInMonth = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { startIso: toMysqlDateTime(start), endIso: toMysqlDateTime(end), daysInMonth };
}

export function anioMesActualUruguay(): { anio: number; mes: number } {
  const [anio, mes] = fechaUyYMD(new Date()).split("-").map(Number);
  return { anio, mes };
}

// Rango del dia anterior (hora Uruguay) -- usado por el cron de medianoche
// para cerrar el dia que justo termino.
export function buildYesterdayRangeUtc(): { startIso: string; endIso: string; fechaYMD: string } {
  const { startIso: startHoyIso } = buildTodayRangeUtc();
  const startHoy = new Date(`${startHoyIso.replace(" ", "T")}Z`);
  const start = new Date(startHoy.getTime() - 24 * 60 * 60 * 1000);
  return { startIso: toMysqlDateTime(start), endIso: startHoyIso, fechaYMD: fechaUyYMD(start) };
}

export function toIsoDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

// Convierte una fecha guardada (interpretada como UTC) al dia calendario
// que le correspondia en Uruguay -- mismo criterio que buildTodayRangeUtc,
// para que un dia "cierre" a la medianoche real de Montevideo.
export function fechaUyYMD(fechaUtc: string | Date): string {
  const date = fechaUtc instanceof Date ? fechaUtc : new Date(`${fechaUtc.replace(" ", "T")}Z`);
  const uruguayDate = new Date(date.getTime() - URUGUAY_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return uruguayDate.toISOString().slice(0, 10);
}

export function nowMysqlDateTime(): string {
  return toMysqlDateTime(new Date());
}

export function toMysqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function toIsoString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return `${value.replace(" ", "T")}Z`;
}
