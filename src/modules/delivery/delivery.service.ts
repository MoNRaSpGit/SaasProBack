import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateDeliveryEventDto } from "./dto/create-delivery-event.dto";
import { CreateDeliverySignupDto } from "./dto/create-delivery-signup.dto";
import { UpdateDeliveryEventDto } from "./dto/update-delivery-event.dto";
import { DeliveryEvent, DeliverySignup, DeliveryUser } from "./delivery.types";

type DeliveryUserRow = RowDataPacket & {
  id: number;
  name: string;
  role: "administrador" | "delivery";
};

type DeliveryEventRow = RowDataPacket & {
  id: number;
  place: string;
  starts_at: string;
  notes: string | null;
  slots: number | null;
  status: "abierto" | "cerrado" | "cancelado";
  created_by: number;
  created_at: string;
};

type DeliverySignupRow = RowDataPacket & {
  id: number;
  event_id: number;
  user_id: number;
  user_name: string;
  created_at: string;
};

// starts_at/created_at se traen SIEMPRE con DATE_FORMAT (nunca la columna
// DATETIME cruda): asi mysql2 los devuelve como string tal cual estan
// guardados, sin convertirlos a un objeto Date reinterpretado con la
// timezone del proceso de Node. Guardamos la hora "de pared" tal cual la
// tipeo el administrador (hora de Montevideo) -- si se dejara que mysql2
// arme un Date, JS lo etiqueta como UTC y cualquier formateo posterior con
// timeZone: "America/Montevideo" le resta 3 horas de mas.
const EVENT_DATE_COLUMNS = `
  id, place,
  DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i:%S') AS starts_at,
  notes, slots, status, created_by,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

const SIGNUP_DATE_COLUMNS = `
  s.id, s.event_id, s.user_id, u.name AS user_name,
  DATE_FORMAT(s.created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

// Misma idea que joker.dateUtils.ts: la hora "de pared" de Montevideo via
// Intl, para comparar contra starts_at (que se guarda tal cual la tipeo el
// administrador, sin conversion de zona) sin arrastrar la timezone del
// proceso de Node.
function getMontevideoNowIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

@Injectable()
export class DeliveryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listUsers(): Promise<{ items: DeliveryUser[] }> {
    const rows = await this.databaseService.query<DeliveryUserRow[]>(
      `SELECT id, name, role FROM saas_delivery_users ORDER BY sort_order ASC`
    );
    return { items: rows.map((row) => this.mapUser(row)) };
  }

  // Trae todos los eventos (mas nuevos primero) con quienes se anotaron a
  // cada uno, armado con un solo select de mas (en vez de N+1 por evento).
  async listEvents(): Promise<{ items: DeliveryEvent[] }> {
    const eventRows = await this.databaseService.query<DeliveryEventRow[]>(
      `SELECT ${EVENT_DATE_COLUMNS}
       FROM saas_delivery_events
       ORDER BY starts_at DESC
       LIMIT 500`
    );

    if (!eventRows.length) {
      return { items: [] };
    }

    const eventIds = eventRows.map((row) => row.id);
    const signupRows = await this.databaseService.query<DeliverySignupRow[]>(
      `SELECT ${SIGNUP_DATE_COLUMNS}
       FROM saas_delivery_signups s
       JOIN saas_delivery_users u ON u.id = s.user_id
       WHERE s.event_id IN (${eventIds.map(() => "?").join(",")})
       ORDER BY s.created_at ASC`,
      eventIds
    );

    const signupsByEvent = new Map<number, DeliverySignup[]>();
    for (const row of signupRows) {
      const list = signupsByEvent.get(row.event_id) ?? [];
      list.push(this.mapSignup(row));
      signupsByEvent.set(row.event_id, list);
    }

    return { items: eventRows.map((row) => this.mapEvent(row, signupsByEvent.get(row.id) ?? [])) };
  }

  async createEvent(dto: CreateDeliveryEventDto): Promise<{ item: DeliveryEvent }> {
    const userRows = await this.databaseService.query<DeliveryUserRow[]>(
      `SELECT id, name, role FROM saas_delivery_users WHERE id = ? LIMIT 1`,
      [dto.createdBy]
    );
    if (!userRows[0] || userRows[0].role !== "administrador") {
      throw new BadRequestException("Solo el administrador puede crear eventos");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_delivery_events (place, starts_at, notes, slots, created_by) VALUES (?, ?, ?, ?, ?)`,
      [dto.place.trim(), this.toMysqlDateTime(dto.startsAt), dto.notes?.trim() || null, dto.slots ?? null, dto.createdBy]
    );

    return this.getEventOrThrow(result.insertId);
  }

  async updateEvent(eventId: number, dto: UpdateDeliveryEventDto): Promise<{ item: DeliveryEvent }> {
    const existingRows = await this.databaseService.query<DeliveryEventRow[]>(
      `SELECT ${EVENT_DATE_COLUMNS} FROM saas_delivery_events WHERE id = ? LIMIT 1`,
      [eventId]
    );
    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundException("Evento no encontrado");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_delivery_events SET place = ?, starts_at = ?, notes = ?, slots = ?, status = ? WHERE id = ?`,
      [
        dto.place?.trim() ?? existing.place,
        this.toMysqlDateTime(dto.startsAt ?? existing.starts_at),
        dto.notes !== undefined ? dto.notes.trim() || null : existing.notes,
        dto.slots !== undefined ? dto.slots : existing.slots,
        dto.status ?? existing.status,
        eventId
      ]
    );

    return this.getEventOrThrow(eventId);
  }

  async deleteEvent(eventId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_delivery_events WHERE id = ?`, [
      eventId
    ]);
    if (result.affectedRows === 0) {
      throw new NotFoundException("Evento no encontrado");
    }
    return { ok: true };
  }

  // Un delivery se anota a un evento. Si el evento tiene cupo (slots)
  // limitado y ya esta lleno, o si no esta abierto, no deja anotarse.
  async createSignup(eventId: number, dto: CreateDeliverySignupDto): Promise<{ item: DeliveryEvent }> {
    const userRows = await this.databaseService.query<DeliveryUserRow[]>(
      `SELECT id, name, role FROM saas_delivery_users WHERE id = ? LIMIT 1`,
      [dto.userId]
    );
    if (!userRows[0] || userRows[0].role !== "delivery") {
      throw new BadRequestException("Solo un delivery puede anotarse a un evento");
    }

    const eventRows = await this.databaseService.query<DeliveryEventRow[]>(
      `SELECT ${EVENT_DATE_COLUMNS} FROM saas_delivery_events WHERE id = ? LIMIT 1`,
      [eventId]
    );
    const event = eventRows[0];
    if (!event) {
      throw new NotFoundException("Evento no encontrado");
    }
    if (event.status !== "abierto") {
      throw new BadRequestException("Este evento ya no esta abierto para anotarse");
    }
    if (event.starts_at < getMontevideoNowIso()) {
      throw new BadRequestException("Este evento ya paso, no te podes anotar");
    }

    if (event.slots !== null) {
      const countRows = await this.databaseService.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM saas_delivery_signups WHERE event_id = ?`,
        [eventId]
      );
      const currentCount = Number((countRows[0] as { total: number }).total);
      if (currentCount >= event.slots) {
        throw new BadRequestException("Este evento ya no tiene cupo disponible");
      }
    }

    try {
      await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_delivery_signups (event_id, user_id) VALUES (?, ?)`,
        [eventId, dto.userId]
      );
    } catch (error) {
      const mysqlError = error as { code?: string };
      if (mysqlError.code === "ER_DUP_ENTRY") {
        throw new ConflictException("Ya estas anotado a este evento");
      }
      throw error;
    }

    return this.getEventOrThrow(eventId);
  }

  async deleteSignup(eventId: number, userId: number): Promise<{ item: DeliveryEvent }> {
    await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_delivery_signups WHERE event_id = ? AND user_id = ?`,
      [eventId, userId]
    );
    return this.getEventOrThrow(eventId);
  }

  private async getEventOrThrow(eventId: number): Promise<{ item: DeliveryEvent }> {
    const eventRows = await this.databaseService.query<DeliveryEventRow[]>(
      `SELECT ${EVENT_DATE_COLUMNS} FROM saas_delivery_events WHERE id = ? LIMIT 1`,
      [eventId]
    );
    const event = eventRows[0];
    if (!event) {
      throw new NotFoundException("Evento no encontrado");
    }

    const signupRows = await this.databaseService.query<DeliverySignupRow[]>(
      `SELECT ${SIGNUP_DATE_COLUMNS}
       FROM saas_delivery_signups s
       JOIN saas_delivery_users u ON u.id = s.user_id
       WHERE s.event_id = ?
       ORDER BY s.created_at ASC`,
      [eventId]
    );

    return { item: this.mapEvent(event, signupRows.map((row) => this.mapSignup(row))) };
  }

  // El frontend manda un datetime-local ("2026-09-18T20:00", sin zona) --
  // se guarda tal cual, como hora local de Montevideo, sin conversiones.
  private toMysqlDateTime(isoLocal: string): string {
    const spaced = isoLocal.replace("T", " ");
    // "2026-09-18 20:00" (16) -> le falta ":00" de segundos.
    return spaced.length === 16 ? `${spaced}:00` : spaced.slice(0, 19);
  }

  private mapUser(row: DeliveryUserRow): DeliveryUser {
    return { id: row.id, name: row.name, role: row.role };
  }

  private mapSignup(row: DeliverySignupRow): DeliverySignup {
    return {
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      userName: row.user_name,
      createdAt: row.created_at
    };
  }

  private mapEvent(row: DeliveryEventRow, signups: DeliverySignup[]): DeliveryEvent {
    return {
      id: row.id,
      place: row.place,
      startsAt: row.starts_at,
      notes: row.notes,
      slots: row.slots,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      signups
    };
  }
}
