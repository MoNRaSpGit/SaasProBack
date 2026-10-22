import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateTallerQuoteDto } from "./dto/create-taller-quote.dto";
import { CreateTallerStockItemDto } from "./dto/create-taller-stock-item.dto";
import { UpdateTallerStockItemDto } from "./dto/update-taller-stock-item.dto";
import { TallerLaborItem, TallerQuote, TallerQuotePart, TallerStockItem } from "./taller.types";

type StockRow = RowDataPacket & { id: number; name: string; quantity: string; unit_price: string; unit: string };
type QuoteRow = RowDataPacket & {
  id: number;
  vehicle_info: string;
  client_name: string | null;
  labor_items_json: string;
  parts_json: string;
  total: string;
  created_at: string;
};

// Stock inicial ficticio para la demo (chapa/pintura/repuestos tipicos de
// un taller) -- el dueño lo va a ir completando con lo real despues.
const DEMO_STOCK: Array<Omit<TallerStockItem, "id">> = [
  { name: "Masilla plástica", quantity: 10, unitPrice: 450, unit: "unidad" },
  { name: "Lija grano 80", quantity: 30, unitPrice: 50, unit: "unidad" },
  { name: "Lija grano 220", quantity: 30, unitPrice: 50, unit: "unidad" },
  { name: "Fondo antióxido", quantity: 8, unitPrice: 890, unit: "litro" },
  { name: "Pintura base (blanco)", quantity: 6, unitPrice: 1200, unit: "litro" },
  { name: "Pintura base (negro)", quantity: 6, unitPrice: 1200, unit: "litro" },
  { name: "Barniz", quantity: 5, unitPrice: 1500, unit: "litro" },
  { name: "Cinta de enmascarar", quantity: 15, unitPrice: 180, unit: "unidad" },
  { name: "Disco de corte", quantity: 12, unitPrice: 220, unit: "unidad" },
  { name: "Espejo retrovisor (genérico)", quantity: 4, unitPrice: 2200, unit: "unidad" }
];

@Injectable()
export class TallerService implements OnModuleInit {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureDemoStock();
  }

  async listStock(): Promise<TallerStockItem[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<StockRow[]>(`SELECT id, name, quantity, unit_price, unit FROM saas_taller_stock ORDER BY name ASC`);
    return rows.map((row) => this.mapStock(row));
  }

  async createStockItem(dto: CreateTallerStockItemDto): Promise<TallerStockItem> {
    await this.ensureTables();
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_taller_stock (name, quantity, unit_price, unit) VALUES (?, ?, ?, ?)`,
      [dto.name.trim(), dto.quantity, dto.unitPrice, dto.unit?.trim() || "unidad"]
    );
    return this.getStockItemOrThrow(result.insertId);
  }

  async updateStockItem(stockId: number, dto: UpdateTallerStockItemDto): Promise<TallerStockItem> {
    await this.ensureTables();
    const sets: string[] = [];
    const values: Array<string | number> = [];
    if (dto.name !== undefined) {
      sets.push("name = ?");
      values.push(dto.name.trim());
    }
    if (dto.quantity !== undefined) {
      sets.push("quantity = ?");
      values.push(dto.quantity);
    }
    if (dto.unitPrice !== undefined) {
      sets.push("unit_price = ?");
      values.push(dto.unitPrice);
    }
    if (dto.unit !== undefined) {
      sets.push("unit = ?");
      values.push(dto.unit.trim() || "unidad");
    }
    if (sets.length > 0) {
      await this.databaseService.execute<ResultSetHeader>(`UPDATE saas_taller_stock SET ${sets.join(", ")} WHERE id = ?`, [
        ...values,
        stockId
      ]);
    }
    return this.getStockItemOrThrow(stockId);
  }

  async deleteStockItem(stockId: number): Promise<void> {
    await this.ensureTables();
    await this.databaseService.execute(`DELETE FROM saas_taller_stock WHERE id = ?`, [stockId]);
  }

  async listQuotes(): Promise<TallerQuote[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<QuoteRow[]>(
      `SELECT id, vehicle_info, client_name, labor_items_json, parts_json, total,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM saas_taller_quotes ORDER BY created_at DESC`
    );
    return rows.map((row) => this.mapQuote(row));
  }

  // Cada repuesto de stock elegido descuenta la cantidad usada -- si no
  // hay suficiente, se avisa y no se genera el presupuesto (ni se toca
  // el stock de ningun item).
  async createQuote(dto: CreateTallerQuoteDto): Promise<TallerQuote> {
    await this.ensureTables();

    const parts: TallerQuotePart[] = [];
    for (const partDto of dto.parts) {
      const stockRows = await this.databaseService.query<StockRow[]>(`SELECT id, name, quantity, unit_price, unit FROM saas_taller_stock WHERE id = ?`, [
        partDto.stockId
      ]);
      const stockRow = stockRows[0];
      if (!stockRow) throw new NotFoundException(`No existe el repuesto #${partDto.stockId}.`);
      const available = Number(stockRow.quantity);
      if (partDto.quantity > available) {
        throw new BadRequestException(`No hay suficiente stock de "${stockRow.name}" (quedan ${available}).`);
      }
      parts.push({ stockId: stockRow.id, name: stockRow.name, quantity: partDto.quantity, unitPrice: Number(stockRow.unit_price) });
    }

    const laborItems: TallerLaborItem[] = dto.laborItems.map((item) => ({
      category: item.category,
      description: item.description.trim(),
      price: item.price
    }));

    const laborTotal = laborItems.reduce((sum, item) => sum + item.price, 0);
    const partsTotal = parts.reduce((sum, part) => sum + part.unitPrice * part.quantity, 0);
    const total = laborTotal + partsTotal;

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_taller_quotes (vehicle_info, client_name, labor_items_json, parts_json, total)
       VALUES (?, ?, ?, ?, ?)`,
      [dto.vehicleInfo.trim(), dto.clientName?.trim() || null, JSON.stringify(laborItems), JSON.stringify(parts), total]
    );

    for (const part of parts) {
      await this.databaseService.execute(`UPDATE saas_taller_stock SET quantity = quantity - ? WHERE id = ?`, [part.quantity, part.stockId]);
    }

    await this.recordAccess(
      "presupuesto_generado",
      `Presupuesto #${result.insertId} - ${dto.vehicleInfo.trim()} - $${total.toLocaleString("es-UY")}`
    );

    return this.getQuoteOrThrow(result.insertId);
  }

  // Login no real (pedido explicito, 21/10/2026: "que solo diga entrar
  // nada mas, es para ver cuando entro alguien") -- un boton "Entrar" sin
  // usuario ni contrasena, solo para dejar constancia de que alguien abrio
  // la app. Se consulta con backend/scripts/inspect-taller-access.js, no
  // tiene pantalla propia dentro de la app.
  async recordEntrada(): Promise<void> {
    await this.recordAccess("entrada", null);
  }

  private async recordAccess(event: "entrada" | "presupuesto_generado", detail: string | null): Promise<void> {
    await this.ensureTables();
    await this.databaseService.execute(`INSERT INTO saas_taller_access_log (event, detail) VALUES (?, ?)`, [event, detail]);
  }

  private async getStockItemOrThrow(stockId: number): Promise<TallerStockItem> {
    const rows = await this.databaseService.query<StockRow[]>(`SELECT id, name, quantity, unit_price, unit FROM saas_taller_stock WHERE id = ?`, [
      stockId
    ]);
    if (!rows[0]) throw new NotFoundException("No existe ese repuesto.");
    return this.mapStock(rows[0]);
  }

  private async getQuoteOrThrow(quoteId: number): Promise<TallerQuote> {
    const rows = await this.databaseService.query<QuoteRow[]>(
      `SELECT id, vehicle_info, client_name, labor_items_json, parts_json, total,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM saas_taller_quotes WHERE id = ?`,
      [quoteId]
    );
    if (!rows[0]) throw new NotFoundException("No existe ese presupuesto.");
    return this.mapQuote(rows[0]);
  }

  private mapStock(row: StockRow): TallerStockItem {
    return { id: row.id, name: row.name, quantity: Number(row.quantity), unitPrice: Number(row.unit_price), unit: row.unit };
  }

  private mapQuote(row: QuoteRow): TallerQuote {
    return {
      id: row.id,
      vehicleInfo: row.vehicle_info,
      clientName: row.client_name,
      laborItems: typeof row.labor_items_json === "string" ? JSON.parse(row.labor_items_json) : (row.labor_items_json as unknown as TallerLaborItem[]),
      parts: typeof row.parts_json === "string" ? JSON.parse(row.parts_json) : (row.parts_json as unknown as TallerQuotePart[]),
      total: Number(row.total),
      createdAt: `${row.created_at}Z`
    };
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
      `CREATE TABLE IF NOT EXISTS saas_taller_stock (
         id INT AUTO_INCREMENT PRIMARY KEY,
         name VARCHAR(120) NOT NULL,
         quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
         unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
         unit VARCHAR(30) NOT NULL DEFAULT 'unidad',
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_taller_quotes (
         id INT AUTO_INCREMENT PRIMARY KEY,
         vehicle_info VARCHAR(160) NOT NULL,
         client_name VARCHAR(120) NULL,
         labor_items_json JSON NOT NULL,
         parts_json JSON NOT NULL,
         total DECIMAL(10, 2) NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_taller_access_log (
         id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
         event ENUM('entrada', 'presupuesto_generado') NOT NULL,
         detail VARCHAR(255) NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  // Siembra el stock demo que falte -- idempotente por nombre.
  private async ensureDemoStock() {
    const existingRows = await this.databaseService.query<RowDataPacket[]>(`SELECT name FROM saas_taller_stock`);
    const existingNames = new Set(existingRows.map((row) => row.name));

    for (const item of DEMO_STOCK) {
      if (existingNames.has(item.name)) continue;
      await this.databaseService.execute(`INSERT INTO saas_taller_stock (name, quantity, unit_price, unit) VALUES (?, ?, ?, ?)`, [
        item.name,
        item.quantity,
        item.unitPrice,
        item.unit
      ]);
    }
  }
}
