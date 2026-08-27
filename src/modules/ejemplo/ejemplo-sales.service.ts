import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateEjemploSaleDto } from "./dto/create-ejemplo-sale.dto";
import { EjemploProductsService } from "./ejemplo-products.service";
import { EjemploClientsService } from "./ejemplo-clients.service";
import { EjemploAccountEntry, EjemploPanelSummary, EjemploPaymentMethod, EjemploSale } from "./ejemplo.types";

type EjemploSaleRow = RowDataPacket & {
  id: number;
  rubro: string;
  product_id: number | null;
  product_name: string;
  price: string | number;
  quantity: number;
  total: string | number;
  payment_method: EjemploPaymentMethod;
  client_id: number | null;
  created_at: string | Date;
};

type EjemploAccountEntryRow = RowDataPacket & {
  id: number;
  client_id: number;
  sale_id: number | null;
  total: string | number;
  is_settled: number;
  created_at: string | Date;
  settled_at: string | Date | null;
};

@Injectable()
export class EjemploSalesService {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly productsService: EjemploProductsService,
    private readonly clientsService: EjemploClientsService
  ) {}

  async createSale(dto: CreateEjemploSaleDto) {
    await this.ensureTables();

    const product = await this.productsService.getProductOrThrow(Number(dto.productId));
    const quantity = dto.quantity ?? 1;
    const total = Math.round(product.price * quantity * 100) / 100;

    if (dto.paymentMethod === "cuenta" && !dto.clientId) {
      throw new BadRequestException("Para pagar a cuenta hay que elegir un cliente.");
    }
    if (dto.clientId) {
      await this.clientsService.getClientOrThrow(Number(dto.clientId));
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ejemplo_sales (rubro, product_id, product_name, price, quantity, total, payment_method, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.rubro,
        product.id,
        product.name,
        product.price,
        quantity,
        total,
        dto.paymentMethod,
        dto.clientId ? Number(dto.clientId) : null
      ]
    );

    if (dto.paymentMethod === "cuenta" && dto.clientId) {
      await this.databaseService.execute(
        `INSERT INTO saas_ejemplo_account_entries (client_id, sale_id, total) VALUES (?, ?, ?)`,
        [Number(dto.clientId), result.insertId, total]
      );
    }

    return { item: await this.getSaleOrThrow(result.insertId) };
  }

  async listSales(rubro?: string) {
    await this.ensureTables();
    const rows = rubro
      ? await this.databaseService.query<EjemploSaleRow[]>(
          `SELECT id, rubro, product_id, product_name, price, quantity, total, payment_method, client_id, created_at
           FROM saas_ejemplo_sales WHERE rubro = ? ORDER BY created_at DESC LIMIT 200`,
          [rubro]
        )
      : await this.databaseService.query<EjemploSaleRow[]>(
          `SELECT id, rubro, product_id, product_name, price, quantity, total, payment_method, client_id, created_at
           FROM saas_ejemplo_sales ORDER BY created_at DESC LIMIT 200`
        );

    return { items: rows.map((row) => this.mapSale(row)) };
  }

  async getPanelSummary(rubro: string): Promise<EjemploPanelSummary> {
    await this.ensureTables();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rows = await this.databaseService.query<EjemploSaleRow[]>(
      `SELECT id, rubro, product_id, product_name, price, quantity, total, payment_method, client_id, created_at
       FROM saas_ejemplo_sales WHERE rubro = ? AND created_at >= ? ORDER BY created_at DESC`,
      [rubro, todayStart]
    );

    const sales = rows.map((row) => this.mapSale(row));

    const paymentTotals: Record<EjemploPaymentMethod, number> = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      cuenta: 0
    };
    const productTotals = new Map<string, { quantity: number; total: number }>();

    let totalVendido = 0;
    for (const sale of sales) {
      totalVendido += sale.total;
      paymentTotals[sale.paymentMethod] += sale.total;

      const current = productTotals.get(sale.productName) ?? { quantity: 0, total: 0 };
      current.quantity += sale.quantity;
      current.total += sale.total;
      productTotals.set(sale.productName, current);
    }

    const topProducts = Array.from(productTotals.entries())
      .map(([productName, value]) => ({ productName, ...value }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5);

    return {
      rubro,
      totalVendido: Math.round(totalVendido * 100) / 100,
      ventasCount: sales.length,
      paymentTotals,
      topProducts
    };
  }

  async listAccountEntries(clientId: number) {
    await this.ensureTables();
    const rows = await this.databaseService.query<EjemploAccountEntryRow[]>(
      `SELECT id, client_id, sale_id, total, is_settled, created_at, settled_at
       FROM saas_ejemplo_account_entries WHERE client_id = ? ORDER BY created_at DESC`,
      [clientId]
    );
    return { items: rows.map((row) => this.mapAccountEntry(row)) };
  }

  async settleAccountEntries(clientId: number) {
    await this.ensureTables();
    await this.databaseService.execute(
      `UPDATE saas_ejemplo_account_entries SET is_settled = 1, settled_at = NOW() WHERE client_id = ? AND is_settled = 0`,
      [clientId]
    );
    return this.listAccountEntries(clientId);
  }

  private async getSaleOrThrow(saleId: number) {
    const rows = await this.databaseService.query<EjemploSaleRow[]>(
      `SELECT id, rubro, product_id, product_name, price, quantity, total, payment_method, client_id, created_at
       FROM saas_ejemplo_sales WHERE id = ? LIMIT 1`,
      [saleId]
    );
    if (!rows.length) {
      throw new NotFoundException("La venta no existe.");
    }
    return this.mapSale(rows[0]);
  }

  private mapSale(row: EjemploSaleRow): EjemploSale {
    return {
      id: String(row.id),
      rubro: row.rubro,
      productId: row.product_id !== null ? String(row.product_id) : null,
      productName: row.product_name,
      price: Number(row.price),
      quantity: row.quantity,
      total: Number(row.total),
      paymentMethod: row.payment_method,
      clientId: row.client_id !== null ? String(row.client_id) : null,
      createdAt: this.toIsoString(row.created_at)
    };
  }

  private mapAccountEntry(row: EjemploAccountEntryRow): EjemploAccountEntry {
    return {
      id: String(row.id),
      clientId: String(row.client_id),
      saleId: row.sale_id !== null ? String(row.sale_id) : null,
      total: Number(row.total),
      isSettled: Boolean(row.is_settled),
      createdAt: this.toIsoString(row.created_at),
      settledAt: row.settled_at ? this.toIsoString(row.settled_at) : null
    };
  }

  private toIsoString(value: string | Date) {
    return value instanceof Date ? value.toISOString() : value;
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
    await this.clientsService.ensureTables();

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_ejemplo_sales (
         id INT AUTO_INCREMENT PRIMARY KEY,
         rubro VARCHAR(60) NOT NULL,
         product_id INT NULL,
         product_name VARCHAR(160) NOT NULL,
         price DECIMAL(12,2) NOT NULL DEFAULT 0,
         quantity INT NOT NULL DEFAULT 1,
         total DECIMAL(12,2) NOT NULL DEFAULT 0,
         payment_method VARCHAR(20) NOT NULL,
         client_id INT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         KEY idx_saas_ejemplo_sales_rubro (rubro),
         KEY idx_saas_ejemplo_sales_client (client_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_ejemplo_account_entries (
         id INT AUTO_INCREMENT PRIMARY KEY,
         client_id INT NOT NULL,
         sale_id INT NULL,
         total DECIMAL(12,2) NOT NULL DEFAULT 0,
         is_settled TINYINT(1) NOT NULL DEFAULT 0,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         settled_at TIMESTAMP NULL,
         KEY idx_saas_ejemplo_account_entries_client (client_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
  }
}
