import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePeluqueriaReservationDto } from "./dto/create-peluqueria-reservation.dto";
import { SavePeluqueriaScheduleDto } from "./dto/save-peluqueria-schedule.dto";
import { addDays, DAYS_AHEAD, isValidSlot, montevideoNow, normalizePhone, parseSchedule, validateScheduleInput } from "./peluqueria-schedule";
import { PeluqueriaAdminSettings, PeluqueriaBusySlot, PeluqueriaReservation, PeluqueriaSalonPublic } from "./peluqueria.types";

type SalonRow = RowDataPacket & { id: number; slug: string; name: string; logo_url: string | null; schedule_json: string };
type BarberRow = RowDataPacket & { id: number; name: string };
type ReservationRow = RowDataPacket & {
  id: number;
  barber_id: number | null;
  peluquero: string;
  reservation_date: string | Date;
  reservation_time: string;
  client_name: string;
  client_phone: string;
  client_visits: number | null;
  created_at: string;
};

function toMysqlDate(value: string | Date) {
  // "reservation_date" es DATE -- mysql2 puede devolverlo como string o como
  // Date segun el driver; se normaliza siempre a "YYYY-MM-DD".
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function mapRow(row: ReservationRow): PeluqueriaReservation {
  return {
    id: row.id,
    barberId: row.barber_id,
    peluquero: row.peluquero,
    date: toMysqlDate(row.reservation_date),
    time: row.reservation_time,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientVisits: Number(row.client_visits ?? 0),
    createdAt: row.created_at
  };
}

@Injectable()
export class PeluqueriaService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async getSalonRow(slug: string): Promise<SalonRow> {
    const rows = await this.databaseService.query<SalonRow[]>(
      `SELECT id, slug, name, logo_url, schedule_json FROM saas_peluqueria_salons WHERE slug = ? LIMIT 1`,
      [slug.trim().toLowerCase()]
    );
    if (!rows[0]) throw new NotFoundException("Peluquería no encontrada");
    return rows[0];
  }

  // Lo que ve la clienta al entrar por el link del local: nombre, logo,
  // peluqueros y horario. Nada de datos de clientes.
  async getPublicSalon(slug: string): Promise<PeluqueriaSalonPublic> {
    const salon = await this.getSalonRow(slug);
    const barbers = await this.databaseService.query<BarberRow[]>(
      `SELECT id, name FROM saas_peluqueria_barbers WHERE salon_id = ? AND active = 1 ORDER BY position ASC, id ASC`,
      [salon.id]
    );
    return {
      slug: salon.slug,
      name: salon.name,
      logoUrl: salon.logo_url,
      barbers: barbers.map((barber) => ({ id: barber.id, name: barber.name })),
      schedule: parseSchedule(salon.schedule_json)
    };
  }

  // Solo que horarios estan ocupados (fecha + hora) de ESE peluquero de ESE
  // local -- sin nombre ni telefono.
  async getBusySlots(slug: string, barberId: number, from: string, to: string): Promise<PeluqueriaBusySlot[]> {
    const salon = await this.getSalonRow(slug);
    const rows = await this.databaseService.query<ReservationRow[]>(
      `SELECT reservation_date, reservation_time
       FROM saas_peluqueria_reservations
       WHERE salon_id = ? AND barber_id = ? AND reservation_date BETWEEN ? AND ?
       ORDER BY reservation_date ASC, reservation_time ASC`,
      [salon.id, barberId, from, to]
    );
    return rows.map((row) => ({ date: toMysqlDate(row.reservation_date), time: row.reservation_time }));
  }

  // Para el panel del dueño: SOLO las reservas de su peluqueria.
  async listReservations(salonId: number): Promise<PeluqueriaReservation[]> {
    const rows = await this.databaseService.query<ReservationRow[]>(
      `SELECT r.id, r.barber_id, r.peluquero, r.reservation_date, r.reservation_time, r.client_name, r.client_phone,
              c.visits AS client_visits, r.created_at
       FROM saas_peluqueria_reservations r
       LEFT JOIN saas_peluqueria_clients c ON c.id = r.client_id
       WHERE r.salon_id = ?
       ORDER BY r.reservation_date ASC, r.reservation_time ASC`,
      [salonId]
    );
    return rows.map(mapRow);
  }

  // Configuracion del dueño: sus peluqueros (tambien los desactivados) y el
  // horario. Siempre filtrado por el local del dueño que inicio sesion.
  async getAdminSettings(salonId: number): Promise<PeluqueriaAdminSettings> {
    const salons = await this.databaseService.query<RowDataPacket[]>(`SELECT schedule_json FROM saas_peluqueria_salons WHERE id = ? LIMIT 1`, [salonId]);
    if (!salons[0]) throw new NotFoundException("Peluquería no encontrada");
    const barbers = await this.databaseService.query<(BarberRow & { active: number })[]>(
      `SELECT id, name, active FROM saas_peluqueria_barbers WHERE salon_id = ? ORDER BY active DESC, position ASC, id ASC`,
      [salonId]
    );
    return {
      schedule: parseSchedule(String(salons[0].schedule_json)),
      barbers: barbers.map((barber) => ({ id: barber.id, name: barber.name, active: Boolean(barber.active) }))
    };
  }

  async saveSchedule(salonId: number, dto: SavePeluqueriaScheduleDto): Promise<PeluqueriaAdminSettings> {
    const result = validateScheduleInput({ slotMinutes: dto.slotMinutes, days: dto.days });
    if ("error" in result) throw new BadRequestException(result.error);
    await this.databaseService.execute(`UPDATE saas_peluqueria_salons SET schedule_json = ? WHERE id = ?`, [JSON.stringify(result.schedule), salonId]);
    return this.getAdminSettings(salonId);
  }

  async addBarber(salonId: number, name: string): Promise<PeluqueriaAdminSettings> {
    const cleanName = name.trim();
    if (cleanName.length < 2) throw new BadRequestException("Poné el nombre del peluquero.");
    try {
      await this.databaseService.execute(
        `INSERT INTO saas_peluqueria_barbers (salon_id, name, position, active)
         SELECT ?, ?, COALESCE(MAX(position), 0) + 1, 1 FROM saas_peluqueria_barbers WHERE salon_id = ?`,
        [salonId, cleanName, salonId]
      );
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        throw new ConflictException("Ya hay un peluquero con ese nombre (fijate si está desactivado).");
      }
      throw error;
    }
    return this.getAdminSettings(salonId);
  }

  // Cambia nombre y/o activo. Nunca se borra: las reservas viejas conservan
  // el nombre y el historial queda intacto; "desactivar" lo saca del link.
  async updateBarber(salonId: number, barberId: number, changes: { name?: string; active?: boolean }): Promise<PeluqueriaAdminSettings> {
    const found = await this.databaseService.query<BarberRow[]>(`SELECT id, name FROM saas_peluqueria_barbers WHERE id = ? AND salon_id = ? LIMIT 1`, [barberId, salonId]);
    if (!found[0]) throw new NotFoundException("Peluquero no encontrado");

    if (changes.active === false) {
      const others = await this.databaseService.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM saas_peluqueria_barbers WHERE salon_id = ? AND active = 1 AND id <> ?`,
        [salonId, barberId]
      );
      if (Number(others[0]?.total ?? 0) === 0) throw new BadRequestException("Tiene que quedar al menos un peluquero activo.");
    }

    const sets: string[] = [];
    const params: Array<string | number> = [];
    if (changes.name !== undefined) {
      const cleanName = changes.name.trim();
      if (cleanName.length < 2) throw new BadRequestException("Poné el nombre del peluquero.");
      sets.push("name = ?");
      params.push(cleanName);
    }
    if (changes.active !== undefined) {
      sets.push("active = ?");
      params.push(changes.active ? 1 : 0);
    }
    if (sets.length > 0) {
      try {
        await this.databaseService.execute(`UPDATE saas_peluqueria_barbers SET ${sets.join(", ")} WHERE id = ? AND salon_id = ?`, [...params, barberId, salonId]);
      } catch (error) {
        if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new ConflictException("Ya hay un peluquero con ese nombre.");
        throw error;
      }
    }
    return this.getAdminSettings(salonId);
  }

  async createReservation(slug: string, dto: CreatePeluqueriaReservationDto): Promise<{ id: number; peluquero: string; date: string; time: string }> {
    const salon = await this.getSalonRow(slug);
    const barbers = await this.databaseService.query<BarberRow[]>(
      `SELECT id, name FROM saas_peluqueria_barbers WHERE id = ? AND salon_id = ? AND active = 1 LIMIT 1`,
      [dto.barberId, salon.id]
    );
    const barber = barbers[0];
    if (!barber) throw new BadRequestException("Ese peluquero no existe en esta peluquería.");

    // El servidor valida el horario (no alcanza con lo que muestre la pantalla).
    const schedule = parseSchedule(salon.schedule_json);
    const now = montevideoNow();
    if (dto.date < now.date || dto.date > addDays(now.date, DAYS_AHEAD + 1)) {
      throw new BadRequestException("Esa fecha no está disponible para reservar.");
    }
    if (!isValidSlot(schedule, dto.date, dto.time)) {
      throw new BadRequestException("Ese horario no existe en esta peluquería.");
    }
    if (dto.date === now.date && dto.time <= now.time) {
      throw new BadRequestException("Ese horario ya pasó.");
    }

    const phoneNorm = normalizePhone(dto.clientPhone);
    if (phoneNorm.length < 7 || phoneNorm.length > 15) {
      throw new BadRequestException("Revisá el número de celular.");
    }
    const clientName = dto.clientName.trim();

    let reservationId: number;
    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_peluqueria_reservations (salon_id, barber_id, peluquero, reservation_date, reservation_time, client_name, client_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [salon.id, barber.id, barber.name, dto.date, dto.time, clientName, dto.clientPhone.trim()]
      );
      reservationId = result.insertId;
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        throw new ConflictException("Ese horario ya fue reservado. Elegí otro.");
      }
      throw error;
    }

    // Ficha del cliente de este local (por celular). Si falla, la reserva ya
    // esta hecha: no se la rompe por esto.
    try {
      await this.databaseService.execute(
        `INSERT INTO saas_peluqueria_clients (salon_id, phone_norm, name, visits, last_visit_at)
         VALUES (?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name), visits = visits + 1, last_visit_at = NOW()`,
        [salon.id, phoneNorm, clientName]
      );
      await this.databaseService.execute(
        `UPDATE saas_peluqueria_reservations SET client_id = (SELECT id FROM saas_peluqueria_clients WHERE salon_id = ? AND phone_norm = ?) WHERE id = ?`,
        [salon.id, phoneNorm, reservationId]
      );
    } catch {
      // se ignora a proposito
    }

    return { id: reservationId, peluquero: barber.name, date: dto.date, time: dto.time };
  }
}
