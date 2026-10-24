import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import {
  ClientesTacuaResumen,
  DistribuidoraCategoria,
  DistribuidoraClienteTacua,
  GpsCategoria,
  GpsClienteTacua,
  PaginatedResult
} from "./clientes-tacua.types";

type DistribuidoraRow = RowDataPacket & {
  id: number;
  code: string | null;
  name: string;
  contact_name: string | null;
  rut: string | null;
  address: string | null;
  phone: string | null;
  seller_code: string | null;
  route: string | null;
};

type GpsRow = RowDataPacket & {
  id: number;
  name: string;
  address: string;
  lat: string | number;
  lng: string | number;
  assigned_username: string | null;
  geo_quality: string | null;
};

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

// Solo lectura: junta los clientes reales de Tacuarembo que ya estan
// cargados en frontend-distribuidora y frontend-gps, para tenerlos
// archivados y poder consultarlos sin git ni deploys nuevos (pedido
// explicito, 24/10/2026). No crea tablas propias ni duplica datos --
// lee directo de saas_distribuidora_clients / saas_gps_clients.
@Injectable()
export class ClientesTacuaService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getResumen(): Promise<ClientesTacuaResumen> {
    const [distribuidoraRows, gpsRows] = await Promise.all([
      this.databaseService.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN address IS NULL OR address = '' THEN 1 ELSE 0 END) AS sin_direccion,
           SUM(CASE WHEN (address IS NOT NULL AND address <> '') AND (phone IS NULL OR phone = '') THEN 1 ELSE 0 END) AS sin_telefono,
           SUM(CASE WHEN (address IS NOT NULL AND address <> '') AND (phone IS NOT NULL AND phone <> '') THEN 1 ELSE 0 END) AS completo
         FROM saas_distribuidora_clients`
      ),
      this.databaseService.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN geo_quality = 'puerta' THEN 1 ELSE 0 END) AS puerta,
           SUM(CASE WHEN geo_quality = 'esquina' THEN 1 ELSE 0 END) AS esquina,
           SUM(CASE WHEN geo_quality = 'calle' THEN 1 ELSE 0 END) AS calle
         FROM saas_gps_clients`
      )
    ]);

    const d = distribuidoraRows[0];
    const g = gpsRows[0];

    return {
      distribuidora: {
        total: Number(d.total || 0),
        completo: Number(d.completo || 0),
        sinDireccion: Number(d.sin_direccion || 0),
        sinTelefono: Number(d.sin_telefono || 0)
      },
      gps: {
        total: Number(g.total || 0),
        puerta: Number(g.puerta || 0),
        esquina: Number(g.esquina || 0),
        calle: Number(g.calle || 0)
      }
    };
  }

  async listDistribuidora(
    categoria: DistribuidoraCategoria,
    busqueda: string,
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<DistribuidoraClienteTacua>> {
    const safePageSize = Math.min(Math.max(1, pageSize || PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX);
    const safePage = Math.max(1, page || 1);
    const offset = (safePage - 1) * safePageSize;

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (busqueda.trim()) {
      conditions.push("(name LIKE ? OR contact_name LIKE ? OR address LIKE ? OR phone LIKE ? OR code LIKE ?)");
      const like = `%${busqueda.trim()}%`;
      params.push(like, like, like, like, like);
    }

    if (categoria === "sin-direccion") {
      conditions.push("(address IS NULL OR address = '')");
    } else if (categoria === "sin-telefono") {
      conditions.push("(address IS NOT NULL AND address <> '') AND (phone IS NULL OR phone = '')");
    } else if (categoria === "completo") {
      conditions.push("(address IS NOT NULL AND address <> '') AND (phone IS NOT NULL AND phone <> '')");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM saas_distribuidora_clients ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const rows = await this.databaseService.query<DistribuidoraRow[]>(
      `SELECT id, code, name, contact_name, rut, address, phone, seller_code, route
       FROM saas_distribuidora_clients
       ${whereClause}
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset]
    );

    return {
      items: rows.map((row) => this.mapDistribuidora(row)),
      total,
      page: safePage,
      pageSize: safePageSize
    };
  }

  async listGps(categoria: GpsCategoria, busqueda: string, page: number, pageSize: number): Promise<PaginatedResult<GpsClienteTacua>> {
    const safePageSize = Math.min(Math.max(1, pageSize || PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX);
    const safePage = Math.max(1, page || 1);
    const offset = (safePage - 1) * safePageSize;

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (busqueda.trim()) {
      conditions.push("(name LIKE ? OR address LIKE ?)");
      const like = `%${busqueda.trim()}%`;
      params.push(like, like);
    }

    if (categoria !== "todos") {
      conditions.push("geo_quality = ?");
      params.push(categoria);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM saas_gps_clients ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const rows = await this.databaseService.query<GpsRow[]>(
      `SELECT id, name, address, lat, lng, assigned_username, geo_quality
       FROM saas_gps_clients
       ${whereClause}
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset]
    );

    return {
      items: rows.map((row) => this.mapGps(row)),
      total,
      page: safePage,
      pageSize: safePageSize
    };
  }

  private mapDistribuidora(row: DistribuidoraRow): DistribuidoraClienteTacua {
    const tieneDireccion = !!row.address && row.address.trim() !== "";
    const tieneTelefono = !!row.phone && row.phone.trim() !== "";
    const categoria = !tieneDireccion ? "sin-direccion" : !tieneTelefono ? "sin-telefono" : "completo";

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      contactName: row.contact_name,
      rut: row.rut,
      address: row.address,
      phone: row.phone,
      sellerCode: row.seller_code,
      route: row.route,
      categoria
    };
  }

  private mapGps(row: GpsRow): GpsClienteTacua {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      lat: Number(row.lat),
      lng: Number(row.lng),
      assignedUsername: row.assigned_username,
      geoQuality: row.geo_quality
    };
  }
}
