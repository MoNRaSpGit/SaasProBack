import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { randomBytes } from "node:crypto";
import { DatabaseService } from "../../shared/database/database.service";

export type GymBookingClass = { key: string; name: string; capacity: number; hours: string[] };
export type GymBookingConfig = { classes: GymBookingClass[] };

const HOURS = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
// Config por defecto (la misma de la demo): Ale la podra cambiar mas adelante.
const DEFAULT_CONFIG: GymBookingConfig = {
  classes: [
    { key: "musculacion", name: "Musculación", capacity: 10, hours: HOURS },
    { key: "zumba", name: "Zumba", capacity: 12, hours: HOURS },
    { key: "funcional", name: "Funcional", capacity: 8, hours: HOURS }
  ]
};
const DAYS_AHEAD = 7;
const TIME_ZONE = "America/Montevideo";

type LinkRow = RowDataPacket & { workspace_key: string; public_token: string; config_json: string | null };
type BookingRow = RowDataPacket & { id: number; class_key: string; slot_hour: string; day: string; student_name: string };

// Fecha y hora "de pared" de Montevideo (el servidor corre en UTC).
function montevideoNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
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

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function cleanName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
}

@Injectable()
export class GymBookingService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async getLinkByToken(token: string): Promise<{ workspaceKey: string; config: GymBookingConfig }> {
    if (!/^[a-f0-9]{32}$/.test(token)) throw new NotFoundException("Link inválido.");
    const rows = await this.databaseService.query<LinkRow[]>(
      `SELECT workspace_key, public_token, config_json FROM saas_gym_booking_links WHERE public_token = ? LIMIT 1`,
      [token]
    );
    if (!rows[0]) throw new NotFoundException("Link inválido.");
    return { workspaceKey: rows[0].workspace_key, config: this.parseConfig(rows[0].config_json) };
  }

  private parseConfig(raw: string | null): GymBookingConfig {
    if (!raw) return DEFAULT_CONFIG;
    try {
      const parsed = JSON.parse(raw) as GymBookingConfig;
      return parsed?.classes?.length ? parsed : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  private async listDay(workspaceKey: string, date: string) {
    const rows = await this.databaseService.query<BookingRow[]>(
      `SELECT id, class_key, slot_hour, DATE_FORMAT(booking_date, '%Y-%m-%d') AS day, student_name
       FROM saas_gym_bookings
       WHERE workspace_key = ? AND booking_date = ?
       ORDER BY slot_hour, id`,
      [workspaceKey, date]
    );
    return rows.map((row) => ({ id: row.id, classKey: row.class_key, hour: row.slot_hour, name: row.student_name }));
  }

  private resolveDate(date: string | undefined): { today: string; time: string; date: string } {
    const now = montevideoNow();
    const wanted = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : now.date;
    if (wanted < now.date || wanted > addDays(now.date, DAYS_AHEAD - 1)) {
      throw new BadRequestException("Esa fecha no está disponible.");
    }
    return { today: now.date, time: now.time, date: wanted };
  }

  // ---------- Publico (con el token del link) ----------

  async getPublicSchedule(token: string, date?: string) {
    const link = await this.getLinkByToken(token);
    const resolved = this.resolveDate(date);
    const days = Array.from({ length: DAYS_AHEAD }, (_, index) => addDays(resolved.today, index));
    const bookings = await this.listDay(link.workspaceKey, resolved.date);
    return {
      today: resolved.today,
      nowTime: resolved.time,
      date: resolved.date,
      days,
      classes: link.config.classes,
      // Sin ids ni codigos: el publico solo ve quien esta anotado.
      bookings: bookings.map(({ classKey, hour, name }) => ({ classKey, hour, name }))
    };
  }

  async book(token: string, dto: { date: string; classKey: string; hour: string; name: string }) {
    const link = await this.getLinkByToken(token);
    const resolved = this.resolveDate(dto.date);
    const gymClass = link.config.classes.find((item) => item.key === dto.classKey);
    if (!gymClass || !gymClass.hours.includes(dto.hour)) throw new BadRequestException("Esa clase u horario no existe.");
    if (resolved.date === resolved.today && dto.hour <= resolved.time) {
      throw new BadRequestException("Ese horario ya pasó.");
    }
    const name = cleanName(dto.name);
    if (name.length < 2) throw new BadRequestException("Poné tu nombre.");

    const cancelCode = randomBytes(8).toString("hex");
    // Insert atomico: solo entra si hay cupo y el nombre no esta repetido.
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gym_bookings (workspace_key, class_key, slot_hour, booking_date, student_name, cancel_code)
       SELECT ?, ?, ?, ?, ?, ? FROM DUAL
       WHERE (SELECT COUNT(*) FROM saas_gym_bookings WHERE workspace_key = ? AND booking_date = ? AND class_key = ? AND slot_hour = ?) < ?
         AND NOT EXISTS (SELECT 1 FROM saas_gym_bookings WHERE workspace_key = ? AND booking_date = ? AND class_key = ? AND slot_hour = ? AND LOWER(student_name) = LOWER(?))`,
      [
        link.workspaceKey, dto.classKey, dto.hour, dto.date, name, cancelCode,
        link.workspaceKey, dto.date, dto.classKey, dto.hour, gymClass.capacity,
        link.workspaceKey, dto.date, dto.classKey, dto.hour, name
      ]
    );

    if (!result.affectedRows) {
      const current = await this.listDay(link.workspaceKey, dto.date);
      const inSlot = current.filter((item) => item.classKey === dto.classKey && item.hour === dto.hour);
      if (inSlot.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        throw new ConflictException("Ya estás anotado/a en ese horario.");
      }
      throw new ConflictException("Ese horario ya está completo.");
    }
    return { ok: true, id: result.insertId, cancelCode, name };
  }

  async cancel(token: string, dto: { id: number; cancelCode: string }) {
    const link = await this.getLinkByToken(token);
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_gym_bookings WHERE id = ? AND workspace_key = ? AND cancel_code = ?`,
      [dto.id, link.workspaceKey, dto.cancelCode]
    );
    if (!result.affectedRows) throw new NotFoundException("No se encontró esa reserva.");
    return { ok: true };
  }

  // ---------- Admin (Ale, con sesion) ----------

  async getAdminDay(workspaceKey: string, date?: string) {
    const rows = await this.databaseService.query<LinkRow[]>(
      `SELECT workspace_key, public_token, config_json FROM saas_gym_booking_links WHERE workspace_key = ? LIMIT 1`,
      [workspaceKey]
    );
    if (!rows[0]) return { enabled: false as const };
    const now = montevideoNow();
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : now.date;
    return {
      enabled: true as const,
      token: rows[0].public_token,
      today: now.date,
      date: day,
      classes: this.parseConfig(rows[0].config_json).classes,
      bookings: await this.listDay(workspaceKey, day)
    };
  }

  async adminDelete(workspaceKey: string, bookingId: number) {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_gym_bookings WHERE id = ? AND workspace_key = ?`,
      [bookingId, workspaceKey]
    );
    if (!result.affectedRows) throw new NotFoundException("No se encontró esa reserva.");
    return { ok: true };
  }
}
