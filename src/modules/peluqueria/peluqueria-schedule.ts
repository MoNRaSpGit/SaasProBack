import { PeluqueriaSchedule } from "./peluqueria.types";

// Cuantos dias hacia adelante se puede reservar.
export const DAYS_AHEAD = 14;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Parsea el JSON guardado; si esta roto o vacio cae en un horario seguro
// (nunca debe romper la pantalla de la clienta).
export function parseSchedule(raw: string): PeluqueriaSchedule {
  try {
    const parsed = JSON.parse(raw) as PeluqueriaSchedule;
    const slotMinutes = Number(parsed.slotMinutes);
    if (!Number.isFinite(slotMinutes) || slotMinutes < 10 || slotMinutes > 240) throw new Error("slot");
    const days: PeluqueriaSchedule["days"] = {};
    for (const [day, ranges] of Object.entries(parsed.days ?? {})) {
      if (!/^[0-6]$/.test(day) || !Array.isArray(ranges)) continue;
      const clean = ranges.filter(
        (range) => Array.isArray(range) && TIME_PATTERN.test(range[0]) && TIME_PATTERN.test(range[1]) && toMinutes(range[0]) < toMinutes(range[1])
      ) as Array<[string, string]>;
      if (clean.length > 0) days[day] = clean;
    }
    return { slotMinutes, days };
  } catch {
    return { slotMinutes: 60, days: { 1: [["09:00", "19:00"]], 2: [["09:00", "19:00"]], 3: [["09:00", "19:00"]], 4: [["09:00", "19:00"]], 5: [["09:00", "19:00"]], 6: [["09:00", "19:00"]] } };
  }
}

export function buildSlotsForWeekday(schedule: PeluqueriaSchedule, weekday: number): string[] {
  const slots: string[] = [];
  for (const [start, end] of schedule.days[String(weekday)] ?? []) {
    for (let minute = toMinutes(start); minute + schedule.slotMinutes <= toMinutes(end); minute += schedule.slotMinutes) {
      slots.push(toTime(minute));
    }
  }
  return slots;
}

// Dia de la semana de "YYYY-MM-DD" sin depender de la zona horaria del servidor.
export function weekdayOf(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isValidSlot(schedule: PeluqueriaSchedule, dateKey: string, time: string): boolean {
  return buildSlotsForWeekday(schedule, weekdayOf(dateKey)).includes(time);
}

// "Ahora" en Montevideo (el servidor corre en UTC).
export function montevideoNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

// Solo digitos, sin el 598 de Uruguay y con el 0 inicial de los celulares:
// "+598 99 123 456", "099123456" y "99123456" son el mismo cliente.
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("598") && digits.length >= 11) digits = digits.slice(3);
  if (digits.length === 8 && digits.startsWith("9")) digits = `0${digits}`;
  return digits;
}
