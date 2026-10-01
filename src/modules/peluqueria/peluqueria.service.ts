import { ConflictException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePeluqueriaReservationDto } from "./dto/create-peluqueria-reservation.dto";
import { PeluqueriaBusySlot, PeluqueriaReservation } from "./peluqueria.types";

type ReservationRow = RowDataPacket & {
  id: number;
  reservation_date: string | Date;
  reservation_time: string;
  client_name: string;
  client_phone: string;
  created_at: string;
};

function toMysqlDate(value: string | Date) {
  // "reservation_date" es DATE -- mysql2 puede devolverlo ya como string
  // "YYYY-MM-DD" o como Date segun el driver; se normaliza siempre a
  // string para no repetir este chequeo en cada mapeo.
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function mapRow(row: ReservationRow): PeluqueriaReservation {
  return {
    id: row.id,
    date: toMysqlDate(row.reservation_date),
    time: row.reservation_time,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    createdAt: row.created_at
  };
}

@Injectable()
export class PeluqueriaService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Para la vista del cliente: solo que horarios estan ocupados (fecha +
  // hora), sin nombre ni telefono -- esos solo los ve quien entre a /admin.
  async getBusySlots(from: string, to: string): Promise<PeluqueriaBusySlot[]> {
    const rows = await this.databaseService.query<ReservationRow[]>(
      `SELECT reservation_date, reservation_time
       FROM saas_peluqueria_reservations
       WHERE reservation_date BETWEEN ? AND ?
       ORDER BY reservation_date ASC, reservation_time ASC`,
      [from, to]
    );

    return rows.map((row) => ({ date: toMysqlDate(row.reservation_date), time: row.reservation_time }));
  }

  // Para /admin: el listado completo, con nombre y telefono -- es la
  // unica forma que tiene el dueno de ver quien reservo (no hay login
  // todavia, pedido explicito: "que no se tenga que loguear").
  async listReservations(): Promise<PeluqueriaReservation[]> {
    const rows = await this.databaseService.query<ReservationRow[]>(
      `SELECT id, reservation_date, reservation_time, client_name, client_phone, created_at
       FROM saas_peluqueria_reservations
       ORDER BY reservation_date ASC, reservation_time ASC`
    );

    return rows.map(mapRow);
  }

  async createReservation(dto: CreatePeluqueriaReservationDto): Promise<PeluqueriaReservation> {
    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_peluqueria_reservations (reservation_date, reservation_time, client_name, client_phone)
         VALUES (?, ?, ?, ?)`,
        [dto.date, dto.time, dto.clientName.trim(), dto.clientPhone.trim()]
      );

      const rows = await this.databaseService.query<ReservationRow[]>(
        `SELECT id, reservation_date, reservation_time, client_name, client_phone, created_at
         FROM saas_peluqueria_reservations WHERE id = ?`,
        [result.insertId]
      );

      return mapRow(rows[0]);
    } catch (error) {
      const mysqlError = error as { code?: string };
      if (mysqlError.code === "ER_DUP_ENTRY") {
        throw new ConflictException("Ese horario ya fue reservado. Elegi otro.");
      }
      throw error;
    }
  }
}
