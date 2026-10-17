// Rango [00:00, 24:00) de un dia (en hora Montevideo), como strings
// UTC-naive listos para comparar contra columnas DATETIME (que en este
// monorepo se guardan en UTC) -- mismo criterio que
// scripts/inspect-piloto-audit.js (dayRangeUtc). Si no se pasa dayLabel, usa
// el dia de hoy en Montevideo.
export function dayRangeUtc(dayLabel?: string) {
  const resolvedDayLabel = dayLabel || todayDayLabel();
  const start = new Date(`${resolvedDayLabel}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return { start: fmt(start), end: fmt(end), dayLabel: resolvedDayLabel };
}

export function todayDayLabel() {
  const montevideoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  return `${montevideoNow.getFullYear()}-${String(montevideoNow.getMonth() + 1).padStart(2, "0")}-${String(
    montevideoNow.getDate()
  ).padStart(2, "0")}`;
}

// Epoch (ms) de los limites de un dia en Montevideo -- para filtrar ids tipo
// "anm-<epoch>" (agro) o "student-<epoch>" (gym), que no tienen columna de
// fecha propia.
export function epochRangeMs(dayLabel?: string) {
  const { start, end } = dayRangeUtc(dayLabel);
  return { startMs: new Date(`${start}Z`).getTime(), endMs: new Date(`${end}Z`).getTime() };
}

export function extractEpoch(id: string): number {
  const match = String(id).match(/\d{10,}/);
  return match ? Number(match[0]) : 0;
}

export function formatMontevideoTime(isoLikeUtc: string): string {
  const withZ = isoLikeUtc.endsWith("Z") ? isoLikeUtc : `${isoLikeUtc}Z`;
  return new Date(withZ).toLocaleTimeString("es-UY", { timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit" });
}

// Valida que sea un YYYY-MM-DD razonable, para no pasar input de usuario
// directo a un New Date()/SQL sin chequear.
export function isValidDayLabel(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
