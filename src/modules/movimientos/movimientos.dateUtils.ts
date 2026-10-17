// Rango [00:00, 24:00) de HOY en hora Montevideo, como strings
// UTC-naive listos para comparar contra columnas DATETIME (que en este
// monorepo se guardan en UTC) -- mismo criterio que
// scripts/inspect-piloto-audit.js (dayRangeUtc).
export function todayRangeUtc() {
  const now = new Date();
  const montevideoNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  const dayLabel = `${montevideoNow.getFullYear()}-${String(montevideoNow.getMonth() + 1).padStart(2, "0")}-${String(
    montevideoNow.getDate()
  ).padStart(2, "0")}`;

  const start = new Date(`${dayLabel}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return { start: fmt(start), end: fmt(end), dayLabel };
}

// Epoch (ms) de los limites del dia de hoy en Montevideo -- para filtrar
// ids tipo "anm-<epoch>" (agro) o "student-<epoch>" (gym), que no tienen
// columna de fecha propia.
export function todayEpochRangeMs() {
  const { start, end } = todayRangeUtc();
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
