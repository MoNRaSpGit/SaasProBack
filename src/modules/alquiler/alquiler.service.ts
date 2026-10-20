import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { RegisterAlquilerPaymentDto } from "./dto/register-alquiler-payment.dto";
import { UpdateAlquilerLocalDto } from "./dto/update-alquiler-local.dto";
import { AlquilerLocal, AlquilerLocalStatus, AlquilerPayment } from "./alquiler.types";

const LOCAL_COUNT = 10;

type LocalRow = RowDataPacket & {
  id: number;
  number: number;
  occupied: number;
  business_type: string | null;
  tenant_name: string | null;
  phone: string | null;
  payment_day: number | null;
  rent_amount: string | null;
  note: string | null;
  paid_through: string | null;
  contract_end_date: string | null;
};

type PaymentRow = RowDataPacket & {
  id: number;
  local_id: number;
  number: number;
  tenant_name: string | null;
  period_due: string;
  amount: string | null;
  note: string | null;
  paid_at: string;
};

const LOCAL_COLUMNS = `id, number, occupied, business_type, tenant_name, phone, payment_day, rent_amount, note,
  DATE_FORMAT(paid_through, '%Y-%m-%d') AS paid_through,
  DATE_FORMAT(contract_end_date, '%Y-%m-%d') AS contract_end_date`;

type DateParts = { year: number; month: number; day: number };

function todayParts(): DateParts {
  const montevideoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  return { year: montevideoNow.getFullYear(), month: montevideoNow.getMonth(), day: montevideoNow.getDate() };
}

function parseDateString(value: string): DateParts {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return { year, month: month - 1, day };
}

function formatDateParts(parts: DateParts): string {
  const y = String(parts.year).padStart(4, "0");
  const m = String(parts.month + 1).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

// Dia-calendario puro (sin hora): alcanza para comparar fechas de
// vencimiento. new Date(y, m, d) a medianoche local del server -- como
// solo se usa para restar dias enteros, el huso horario del server no
// afecta el resultado.
function toComparableDate(parts: DateParts): Date {
  return new Date(parts.year, parts.month, parts.day);
}

function thisMonthOccurrence(today: DateParts, paymentDay: number): DateParts {
  return { year: today.year, month: today.month, day: clampDay(today.year, today.month, paymentDay) };
}

function nextOccurrenceAfter(paidThrough: DateParts, paymentDay: number): DateParts {
  let year = paidThrough.year;
  let month = paidThrough.month + 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  return { year, month, day: clampDay(year, month, paymentDay) };
}

@Injectable()
export class AlquilerService implements OnModuleInit {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureLocales();
  }

  async listLocales(): Promise<AlquilerLocal[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<LocalRow[]>(`SELECT ${LOCAL_COLUMNS} FROM saas_alquiler_locales ORDER BY number ASC`);
    return rows.map((row) => this.mapLocal(row));
  }

  async updateLocal(localId: number, dto: UpdateAlquilerLocalDto): Promise<AlquilerLocal> {
    await this.ensureTables();
    const sets: string[] = [];
    const values: Array<string | number | null> = [];

    if (dto.occupied !== undefined) {
      sets.push("occupied = ?");
      values.push(dto.occupied ? 1 : 0);
      // Al marcar un local como vacio, se descarta el vencimiento que
      // tenia -- cuando entre un inquilino nuevo arranca de cero.
      if (!dto.occupied) {
        sets.push("paid_through = NULL");
      }
    }
    if (dto.businessType !== undefined) {
      sets.push("business_type = ?");
      values.push(dto.businessType.trim() || null);
    }
    if (dto.tenantName !== undefined) {
      sets.push("tenant_name = ?");
      values.push(dto.tenantName.trim() || null);
    }
    if (dto.phone !== undefined) {
      sets.push("phone = ?");
      values.push(dto.phone.trim() || null);
    }
    if (dto.paymentDay !== undefined) {
      sets.push("payment_day = ?");
      values.push(dto.paymentDay);
    }
    if (dto.rentAmount !== undefined) {
      sets.push("rent_amount = ?");
      values.push(dto.rentAmount);
    }
    if (dto.note !== undefined) {
      sets.push("note = ?");
      values.push(dto.note.trim() || null);
    }
    if (dto.contractEndDate !== undefined) {
      sets.push("contract_end_date = ?");
      values.push(dto.contractEndDate.trim() || null);
    }

    if (sets.length > 0) {
      await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_alquiler_locales SET ${sets.join(", ")} WHERE id = ?`, [
        ...values,
        localId
      ]);
    }

    return this.getLocalOrThrow(localId);
  }

  async registerPayment(localId: number, dto: RegisterAlquilerPaymentDto): Promise<AlquilerLocal> {
    await this.ensureTables();
    const rows = await this.databaseService.query<LocalRow[]>(`SELECT ${LOCAL_COLUMNS} FROM saas_alquiler_locales WHERE id = ?`, [localId]);
    const row = rows[0];
    if (!row) throw new NotFoundException("No existe ese local.");
    if (!row.occupied || !row.payment_day) {
      throw new NotFoundException("Ese local no tiene inquilino/fecha de pago configurada.");
    }

    const dueDate = this.computeDueDate(row);
    if (!dueDate) throw new NotFoundException("No se pudo calcular el vencimiento.");
    const dueDateStr = formatDateParts(dueDate);

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_alquiler_payments (local_id, period_due, amount, note) VALUES (?, ?, ?, ?)`,
      [localId, dueDateStr, dto.amount ?? row.rent_amount ?? null, dto.note?.trim() || null]
    );
    await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_alquiler_locales SET paid_through = ? WHERE id = ?`, [
      dueDateStr,
      localId
    ]);

    return this.getLocalOrThrow(localId);
  }

  async listPayments(localId?: number): Promise<AlquilerPayment[]> {
    await this.ensureTables();
    const rows = localId
      ? await this.databaseService.query<PaymentRow[]>(
          `SELECT p.id, p.local_id, l.number, l.tenant_name,
                  DATE_FORMAT(p.period_due, '%Y-%m-%d') AS period_due, p.amount, p.note,
                  DATE_FORMAT(p.paid_at, '%Y-%m-%dT%H:%i:%s') AS paid_at
           FROM saas_alquiler_payments p
           JOIN saas_alquiler_locales l ON l.id = p.local_id
           WHERE p.local_id = ?
           ORDER BY p.paid_at DESC`,
          [localId]
        )
      : await this.databaseService.query<PaymentRow[]>(
          `SELECT p.id, p.local_id, l.number, l.tenant_name,
                  DATE_FORMAT(p.period_due, '%Y-%m-%d') AS period_due, p.amount, p.note,
                  DATE_FORMAT(p.paid_at, '%Y-%m-%dT%H:%i:%s') AS paid_at
           FROM saas_alquiler_payments p
           JOIN saas_alquiler_locales l ON l.id = p.local_id
           ORDER BY p.paid_at DESC`
        );

    return rows.map((row) => ({
      id: row.id,
      localId: row.local_id,
      localNumber: row.number,
      tenantName: row.tenant_name,
      periodDue: row.period_due,
      amount: row.amount === null ? null : Number(row.amount),
      note: row.note,
      paidAt: `${row.paid_at}Z`
    }));
  }

  private async getLocalOrThrow(localId: number): Promise<AlquilerLocal> {
    const rows = await this.databaseService.query<LocalRow[]>(`SELECT ${LOCAL_COLUMNS} FROM saas_alquiler_locales WHERE id = ?`, [localId]);
    if (!rows[0]) throw new NotFoundException("No existe ese local.");
    return this.mapLocal(rows[0]);
  }

  private computeDueDate(row: LocalRow): DateParts | null {
    if (!row.payment_day) return null;
    const today = todayParts();
    if (row.paid_through) {
      return nextOccurrenceAfter(parseDateString(row.paid_through), row.payment_day);
    }
    return thisMonthOccurrence(today, row.payment_day);
  }

  private mapLocal(row: LocalRow): AlquilerLocal {
    const occupied = Boolean(row.occupied);
    const base = {
      id: row.id,
      number: row.number,
      occupied,
      businessType: row.business_type,
      tenantName: row.tenant_name,
      phone: row.phone,
      paymentDay: row.payment_day,
      rentAmount: row.rent_amount === null ? null : Number(row.rent_amount),
      note: row.note,
      lastPaidThrough: row.paid_through
    };

    const today = todayParts();
    let daysUntilContractEnd: number | null = null;
    if (row.contract_end_date) {
      const contractEndParts = parseDateString(row.contract_end_date);
      const diffMs = toComparableDate(contractEndParts).getTime() - toComparableDate(today).getTime();
      daysUntilContractEnd = Math.round(diffMs / (24 * 60 * 60 * 1000));
    }
    const contractFields = { contractEndDate: row.contract_end_date, daysUntilContractEnd };

    if (!occupied) {
      return { ...base, ...contractFields, dueDate: null, daysUntilDue: null, status: "vacio" };
    }

    const dueParts = this.computeDueDate(row);
    if (!dueParts) {
      return { ...base, ...contractFields, dueDate: null, daysUntilDue: null, status: "blanco" };
    }

    const diffMs = toComparableDate(dueParts).getTime() - toComparableDate(today).getTime();
    const daysUntilDue = Math.round(diffMs / (24 * 60 * 60 * 1000));

    let status: AlquilerLocalStatus;
    if (daysUntilDue < 0) status = "rojo";
    else if (daysUntilDue <= 7) status = "amarillo";
    else status = "blanco";

    return { ...base, ...contractFields, dueDate: formatDateParts(dueParts), daysUntilDue, status };
  }

  private async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables().catch((error) => {
        this.ensureTablesPromise = null;
        throw error;
      });
    }
    await this.ensureTablesPromise;
  }

  private async createTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_alquiler_locales (
         id INT AUTO_INCREMENT PRIMARY KEY,
         number INT NOT NULL UNIQUE,
         occupied TINYINT(1) NOT NULL DEFAULT 0,
         business_type VARCHAR(80) NULL,
         tenant_name VARCHAR(120) NULL,
         phone VARCHAR(40) NULL,
         payment_day TINYINT NULL,
         rent_amount DECIMAL(10, 2) NULL,
         note VARCHAR(500) NULL,
         paid_through DATE NULL,
         contract_end_date DATE NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    // Migracion (20/10/2026): la tabla ya existia sin contract_end_date --
    // mismo chequeo que scrum.service.ts.
    const contractEndColumn = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'saas_alquiler_locales' AND column_name = 'contract_end_date'`
    );
    if (Number(contractEndColumn[0]?.total || 0) === 0) {
      await this.databaseService.execute(`ALTER TABLE saas_alquiler_locales ADD COLUMN contract_end_date DATE NULL AFTER paid_through`);
    }

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_alquiler_payments (
         id INT AUTO_INCREMENT PRIMARY KEY,
         local_id INT NOT NULL,
         period_due DATE NOT NULL,
         amount DECIMAL(10, 2) NULL,
         note VARCHAR(300) NULL,
         paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT fk_alquiler_payments_local FOREIGN KEY (local_id) REFERENCES saas_alquiler_locales (id) ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  // Siembra los 10 locales vacios la primera vez -- son los locales reales
  // del negocio, no hay datos ficticios: el dueño los va completando el.
  private async ensureLocales() {
    const rows = await this.databaseService.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM saas_alquiler_locales`);
    if (Number(rows[0]?.count ?? 0) > 0) return;

    for (let number = 1; number <= LOCAL_COUNT; number += 1) {
      await this.databaseService.execute(`INSERT INTO saas_alquiler_locales (number, occupied) VALUES (?, 0)`, [number]);
    }
  }
}
