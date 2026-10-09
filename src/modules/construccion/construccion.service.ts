import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateAnticipoDto } from "./dto/create-anticipo.dto";
import { CreateObraDto } from "./dto/create-obra.dto";
import { CreatePersonalDto } from "./dto/create-personal.dto";
import { SaveAsistenciasDto } from "./dto/save-asistencias.dto";
import { SaveSeguridadDto } from "./dto/save-seguridad.dto";
import { TrackActivityDto } from "./dto/track-activity.dto";
import { UpdateObraDto } from "./dto/update-obra.dto";
import { UpdatePersonalDto } from "./dto/update-personal.dto";
import {
  ConstruccionAnticipo,
  ConstruccionAsistencia,
  ConstruccionLiquidacionItem,
  ConstruccionObra,
  ConstruccionPersonal,
  ConstruccionSeguridad,
  SeguridadItem
} from "./construccion.types";

type ObraRow = RowDataPacket & {
  id: number;
  nombre: string;
  direccion: string;
  activa: number;
  created_at: string;
};

type PersonalRow = RowDataPacket & {
  id: number;
  nombre: string;
  cargo: string;
  telefono: string;
  obra_id: number | null;
  jornal: string;
  fecha_ingreso: string | Date;
  activo: number;
  created_at: string;
};

type AsistenciaRow = RowDataPacket & {
  id: number;
  personal_id: number;
  fecha: string | Date;
  estado: "presente" | "media" | "ausente";
};

type SeguridadRow = RowDataPacket & {
  id: number;
  personal_id: number;
  fecha: string | Date;
  cumple: number;
  items_faltantes: string;
};

type AnticipoRow = RowDataPacket & {
  id: number;
  personal_id: number;
  fecha: string | Date;
  monto: string;
  nota: string;
  created_at: string;
};

function toDateStr(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapObra(row: ObraRow): ConstruccionObra {
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    activa: Boolean(row.activa),
    createdAt: row.created_at
  };
}

function mapPersonal(row: PersonalRow): ConstruccionPersonal {
  return {
    id: row.id,
    nombre: row.nombre,
    cargo: row.cargo,
    telefono: row.telefono,
    obraId: row.obra_id,
    jornal: Number(row.jornal),
    fechaIngreso: toDateStr(row.fecha_ingreso),
    activo: Boolean(row.activo),
    createdAt: row.created_at
  };
}

function mapSeguridad(row: SeguridadRow): ConstruccionSeguridad {
  const itemsFaltantes = typeof row.items_faltantes === "string" ? JSON.parse(row.items_faltantes) : row.items_faltantes;
  return {
    id: row.id,
    personalId: row.personal_id,
    fecha: toDateStr(row.fecha),
    cumple: Boolean(row.cumple),
    itemsFaltantes: itemsFaltantes ?? []
  };
}

function mapAsistencia(row: AsistenciaRow): ConstruccionAsistencia {
  return {
    id: row.id,
    personalId: row.personal_id,
    fecha: toDateStr(row.fecha),
    estado: row.estado
  };
}

function mapAnticipo(row: AnticipoRow): ConstruccionAnticipo {
  return {
    id: row.id,
    personalId: row.personal_id,
    fecha: toDateStr(row.fecha),
    monto: Number(row.monto),
    nota: row.nota,
    createdAt: row.created_at
  };
}

@Injectable()
export class ConstruccionService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listObras(): Promise<ConstruccionObra[]> {
    const rows = await this.databaseService.query<ObraRow[]>(
      `SELECT * FROM saas_construccion_obras ORDER BY activa DESC, nombre ASC`
    );
    return rows.map(mapObra);
  }

  async createObra(dto: CreateObraDto): Promise<ConstruccionObra> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_construccion_obras (nombre, direccion) VALUES (?, ?)`,
      [dto.nombre.trim(), dto.direccion?.trim() ?? ""]
    );
    const rows = await this.databaseService.query<ObraRow[]>(`SELECT * FROM saas_construccion_obras WHERE id = ?`, [
      result.insertId
    ]);
    return mapObra(rows[0]);
  }

  async updateObra(id: number, dto: UpdateObraDto): Promise<ConstruccionObra> {
    const existing = await this.databaseService.query<ObraRow[]>(`SELECT * FROM saas_construccion_obras WHERE id = ?`, [
      id
    ]);
    if (!existing[0]) throw new NotFoundException("Obra no encontrada");

    await this.databaseService.execute(
      `UPDATE saas_construccion_obras SET nombre = ?, direccion = ?, activa = ? WHERE id = ?`,
      [
        dto.nombre?.trim() ?? existing[0].nombre,
        dto.direccion !== undefined ? dto.direccion.trim() : existing[0].direccion,
        dto.activa !== undefined ? Number(dto.activa) : existing[0].activa,
        id
      ]
    );
    const rows = await this.databaseService.query<ObraRow[]>(`SELECT * FROM saas_construccion_obras WHERE id = ?`, [id]);
    return mapObra(rows[0]);
  }

  async listPersonal(obraId?: number): Promise<ConstruccionPersonal[]> {
    const rows = obraId
      ? await this.databaseService.query<PersonalRow[]>(
          `SELECT * FROM saas_construccion_personal WHERE obra_id = ? ORDER BY activo DESC, nombre ASC`,
          [obraId]
        )
      : await this.databaseService.query<PersonalRow[]>(
          `SELECT * FROM saas_construccion_personal ORDER BY activo DESC, nombre ASC`
        );
    return rows.map(mapPersonal);
  }

  async createPersonal(dto: CreatePersonalDto): Promise<ConstruccionPersonal> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_construccion_personal (nombre, cargo, telefono, obra_id, jornal, fecha_ingreso)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dto.nombre.trim(), dto.cargo, dto.telefono?.trim() ?? "", dto.obraId ?? null, dto.jornal, dto.fechaIngreso]
    );
    const rows = await this.databaseService.query<PersonalRow[]>(
      `SELECT * FROM saas_construccion_personal WHERE id = ?`,
      [result.insertId]
    );
    return mapPersonal(rows[0]);
  }

  async updatePersonal(id: number, dto: UpdatePersonalDto): Promise<ConstruccionPersonal> {
    const existing = await this.databaseService.query<PersonalRow[]>(
      `SELECT * FROM saas_construccion_personal WHERE id = ?`,
      [id]
    );
    if (!existing[0]) throw new NotFoundException("Personal no encontrado");
    const current = existing[0];

    await this.databaseService.execute(
      `UPDATE saas_construccion_personal
       SET nombre = ?, cargo = ?, telefono = ?, obra_id = ?, jornal = ?, fecha_ingreso = ?, activo = ?
       WHERE id = ?`,
      [
        dto.nombre?.trim() ?? current.nombre,
        dto.cargo ?? current.cargo,
        dto.telefono !== undefined ? dto.telefono.trim() : current.telefono,
        dto.obraId !== undefined ? dto.obraId : current.obra_id,
        dto.jornal !== undefined ? dto.jornal : current.jornal,
        dto.fechaIngreso ?? toDateStr(current.fecha_ingreso),
        dto.activo !== undefined ? Number(dto.activo) : current.activo,
        id
      ]
    );
    const rows = await this.databaseService.query<PersonalRow[]>(
      `SELECT * FROM saas_construccion_personal WHERE id = ?`,
      [id]
    );
    return mapPersonal(rows[0]);
  }

  async getAsistenciasByFecha(fecha: string): Promise<ConstruccionAsistencia[]> {
    const rows = await this.databaseService.query<AsistenciaRow[]>(
      `SELECT * FROM saas_construccion_asistencias WHERE fecha = ?`,
      [fecha]
    );
    return rows.map(mapAsistencia);
  }

  async saveAsistencias(dto: SaveAsistenciasDto): Promise<ConstruccionAsistencia[]> {
    for (const item of dto.items) {
      await this.databaseService.execute(
        `INSERT INTO saas_construccion_asistencias (personal_id, fecha, estado)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
        [item.personalId, dto.fecha, item.estado]
      );
    }
    return this.getAsistenciasByFecha(dto.fecha);
  }

  async getSeguridadByFecha(fecha: string): Promise<ConstruccionSeguridad[]> {
    const rows = await this.databaseService.query<SeguridadRow[]>(
      `SELECT * FROM saas_construccion_seguridad WHERE fecha = ?`,
      [fecha]
    );
    return rows.map(mapSeguridad);
  }

  async saveSeguridad(dto: SaveSeguridadDto): Promise<ConstruccionSeguridad[]> {
    for (const item of dto.items) {
      const itemsFaltantes: SeguridadItem[] = item.cumple ? [] : (item.itemsFaltantes as SeguridadItem[]);
      await this.databaseService.execute(
        `INSERT INTO saas_construccion_seguridad (personal_id, fecha, cumple, items_faltantes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE cumple = VALUES(cumple), items_faltantes = VALUES(items_faltantes)`,
        [item.personalId, dto.fecha, Number(item.cumple), JSON.stringify(itemsFaltantes)]
      );
    }
    return this.getSeguridadByFecha(dto.fecha);
  }

  async listAnticipos(personalId?: number): Promise<ConstruccionAnticipo[]> {
    const rows = personalId
      ? await this.databaseService.query<AnticipoRow[]>(
          `SELECT * FROM saas_construccion_anticipos WHERE personal_id = ? ORDER BY fecha DESC`,
          [personalId]
        )
      : await this.databaseService.query<AnticipoRow[]>(`SELECT * FROM saas_construccion_anticipos ORDER BY fecha DESC`);
    return rows.map(mapAnticipo);
  }

  async createAnticipo(dto: CreateAnticipoDto): Promise<ConstruccionAnticipo> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_construccion_anticipos (personal_id, fecha, monto, nota) VALUES (?, ?, ?, ?)`,
      [dto.personalId, dto.fecha, dto.monto, dto.nota?.trim() ?? ""]
    );
    const rows = await this.databaseService.query<AnticipoRow[]>(
      `SELECT * FROM saas_construccion_anticipos WHERE id = ?`,
      [result.insertId]
    );
    return mapAnticipo(rows[0]);
  }

  // Liquidacion de un mes (YYYY-MM): suma dias presentes (1) + medios
  // (0.5) * jornal, menos anticipos cobrados en ese mes. Se calcula al
  // vuelo -- no se persiste nada nuevo, es una vista derivada de
  // asistencias + anticipos (pedido implicito: "a fin de mes la app ya
  // te dice cuanto pagarle").
  async getLiquidacion(month: string): Promise<ConstruccionLiquidacionItem[]> {
    const from = `${month}-01`;
    const to = `${month}-31`;

    const personalRows = await this.databaseService.query<PersonalRow[]>(
      `SELECT * FROM saas_construccion_personal WHERE activo = 1 ORDER BY nombre ASC`
    );

    const asistenciaRows = await this.databaseService.query<AsistenciaRow[]>(
      `SELECT * FROM saas_construccion_asistencias WHERE fecha BETWEEN ? AND ?`,
      [from, to]
    );

    const anticipoRows = await this.databaseService.query<AnticipoRow[]>(
      `SELECT * FROM saas_construccion_anticipos WHERE fecha BETWEEN ? AND ?`,
      [from, to]
    );

    return personalRows.map((personal) => {
      const asistencias = asistenciaRows.filter((row) => row.personal_id === personal.id);
      const diasPresentes = asistencias.filter((row) => row.estado === "presente").length;
      const diasMedios = asistencias.filter((row) => row.estado === "media").length;
      const diasAusentes = asistencias.filter((row) => row.estado === "ausente").length;
      const jornal = Number(personal.jornal);
      const totalJornales = (diasPresentes + diasMedios * 0.5) * jornal;
      const totalAnticipos = anticipoRows
        .filter((row) => row.personal_id === personal.id)
        .reduce((sum, row) => sum + Number(row.monto), 0);

      return {
        personalId: personal.id,
        nombre: personal.nombre,
        cargo: personal.cargo,
        obraId: personal.obra_id,
        jornal,
        diasPresentes,
        diasMedios,
        diasAusentes,
        totalJornales,
        totalAnticipos,
        totalAPagar: totalJornales - totalAnticipos
      };
    });
  }

  // Registro interno de uso -- PARA NOSOTROS, no hay pantalla en la app
  // que lo muestre (se consulta con scripts/inspect-construccion-activity.js).
  // Sirve para saber si el cliente entro y que toco, ya que no hay login.
  async trackActivity(dto: TrackActivityDto, userAgent?: string): Promise<void> {
    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_construccion_activity_log (visitor_id, event, detail, user_agent, occurred_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
      [dto.visitorId, dto.event, dto.detail?.trim() || null, userAgent?.slice(0, 255) || null]
    );
  }
}
