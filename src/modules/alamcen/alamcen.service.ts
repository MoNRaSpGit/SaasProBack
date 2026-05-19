import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { AlamcenRequestUser, AlamcenDashboardResponse, AlamcenProductLookupResponse, AlamcenStatusResponse } from "./alamcen.types";
import { CreateManualProductDto } from "./dto/create-manual-product.dto";
import { CreateAlamcenPaymentDto } from "./dto/create-payment.dto";
import { CreateAlamcenSaleDto } from "./dto/create-sale.dto";
import { GetAlamcenDashboardDto } from "./dto/get-dashboard.dto";
import { ListAlamcenProductsDto } from "./dto/list-products.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

type AlamcenProductRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  legacy_product_id: number | null;
  name: string;
  description: string | null;
  barcode: string;
  barcode_normalized: string;
  sale_price: string | number;
  list_price: string | number | null;
  stock_current: string | number;
  category: string | null;
  image_url: string | null;
  status: "active" | "inactive" | "out_of_stock" | "archived";
  created_at: string | Date;
  updated_at: string | Date;
};

type SaleRow = RowDataPacket & {
  id: number;
  total_amount: string | number;
  created_at: string | Date;
};

type SaleItemRow = RowDataPacket & {
  sale_id: number;
  id: number;
  product_name: string;
  quantity: string | number;
  line_total: string | number;
};

type PaymentRow = RowDataPacket & {
  id: number;
  amount: string | number;
  description: string | null;
  created_at: string | Date;
};

type RankingRow = RowDataPacket & {
  ranking_key: string;
  name: string;
  qty: string | number;
  image_url: string | null;
};

const STORE_UTC_OFFSET_HOURS = 3;
const DEFAULT_MOVEMENT_LIMIT = 20;
const DEFAULT_RANKING_LIMIT = 10;

function roundMoney(value: number | string | null | undefined) {
  return Number(Number(value || 0).toFixed(2));
}

function toCanonicalIsoUtc(rawValue: string | Date | null | undefined) {
  if (!rawValue) {
    return null;
  }

  if (rawValue instanceof Date) {
    return rawValue.toISOString();
  }

  const value = String(rawValue).trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(value.replace(" ", "T") + "Z").toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeBarcode(value: string) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function mapProductStatus(status: AlamcenProductRow["status"]) {
  switch (status) {
    case "inactive":
      return "inactivo";
    case "out_of_stock":
      return "sin_stock";
    case "archived":
      return "archivado";
    default:
      return "activo";
  }
}

function getStoreDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function parseDateLabel(dateLabel: string) {
  const match = String(dateLabel || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new BadRequestException("La fecha debe tener formato YYYY-MM-DD.");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function addDaysToDateLabel(dateLabel: string, deltaDays: number) {
  const { year, month, day } = parseDateLabel(dateLabel);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function buildBusinessDateRangeUtc(dateLabel: string) {
  const { year, month, day } = parseDateLabel(dateLabel);
  const start = new Date(Date.UTC(year, month - 1, day, STORE_UTC_OFFSET_HOURS, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, STORE_UTC_OFFSET_HOURS, 0, 0));

  return {
    startIso: start.toISOString().slice(0, 19).replace("T", " "),
    endIso: end.toISOString().slice(0, 19).replace("T", " ")
  };
}

@Injectable()
export class AlamcenService {
  constructor(private readonly databaseService: DatabaseService) {}

  getStatus(currentUser: AlamcenRequestUser): AlamcenStatusResponse {
    return {
      module: "alamcen",
      tenant: {
        id: currentUser.tenantId,
        name: currentUser.tenantName,
        slug: currentUser.tenantSlug
      },
      user: {
        id: currentUser.userId,
        email: currentUser.email,
        membershipRole: currentUser.membershipRole
      },
      backend: {
        database: "connected",
        currentTimestamp: new Date().toISOString()
      },
      phase: "sprint-1",
      capabilities: ["products", "sales", "payments", "dashboard"]
    };
  }

  async listProducts(currentUser: AlamcenRequestUser, query: ListAlamcenProductsDto) {
    const limit = Number.isInteger(query.limit) ? Number(query.limit) : 20;
    const search = normalizeText(query.search, 180);

    const rows = search
      ? await this.databaseService.query<AlamcenProductRow[]>(
          `SELECT
             id,
             tenant_id,
             legacy_product_id,
             name,
             description,
             barcode,
             barcode_normalized,
             sale_price,
             list_price,
             stock_current,
             category,
             image_url,
             status,
             created_at,
             updated_at
           FROM saas_alamcen_products
           WHERE tenant_id = ?
             AND deleted_at IS NULL
             AND name LIKE ?
           ORDER BY name ASC, id ASC
           LIMIT ?`,
          [currentUser.tenantId, `%${search}%`, limit]
        )
      : await this.databaseService.query<AlamcenProductRow[]>(
          `SELECT
             id,
             tenant_id,
             legacy_product_id,
             name,
             description,
             barcode,
             barcode_normalized,
             sale_price,
             list_price,
             stock_current,
             category,
             image_url,
             status,
             created_at,
             updated_at
           FROM saas_alamcen_products
           WHERE tenant_id = ?
             AND deleted_at IS NULL
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
          [currentUser.tenantId, limit]
        );

    return {
      count: rows.length,
      items: rows.map((row) => this.mapProductRow(row))
    };
  }

  async getProductByBarcode(currentUser: AlamcenRequestUser, barcode: string) {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) {
      throw new BadRequestException("El codigo de barras es obligatorio.");
    }

    const row = await this.findProductRowByBarcode(currentUser.tenantId, normalizedBarcode);
    return row ? this.mapProductRow(row) : null;
  }

  async createManualProduct(currentUser: AlamcenRequestUser, payload: CreateManualProductDto) {
    const barcode = normalizeBarcode(payload.barcode);
    if (!barcode) {
      throw new BadRequestException("El codigo de barras es obligatorio.");
    }

    const existingProduct = await this.findProductRowByBarcode(currentUser.tenantId, barcode);
    if (existingProduct) {
      return this.mapProductRow(existingProduct);
    }

    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_alamcen_products (
           tenant_id,
           name,
           barcode,
           barcode_normalized,
           sale_price,
           stock_current,
           category,
           image_url,
           status,
           source
         ) VALUES (?, ?, ?, ?, ?, 0, ?, NULL, 'active', 'manual')`,
        [currentUser.tenantId, "Producto Manual", barcode, barcode, payload.price, "manual"]
      );

      const created = await this.findProductRowById(currentUser.tenantId, Number(result.insertId));
      if (!created) {
        throw new BadRequestException("No se pudo recuperar el producto manual creado.");
      }

      return this.mapProductRow(created);
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "ER_DUP_ENTRY") {
        const duplicatedProduct = await this.findProductRowByBarcode(currentUser.tenantId, barcode);
        if (duplicatedProduct) {
          return this.mapProductRow(duplicatedProduct);
        }

        throw new ConflictException("El codigo de barras ya existe.");
      }

      throw error;
    }
  }

  async updateProduct(currentUser: AlamcenRequestUser, productId: number, payload: UpdateProductDto) {
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new BadRequestException("El producto es obligatorio.");
    }

    const normalizedName = normalizeText(payload.nombre, 180);
    if (!normalizedName) {
      throw new BadRequestException("El nombre es obligatorio.");
    }

    const existing = await this.findProductRowById(currentUser.tenantId, productId);
    if (!existing) {
      throw new NotFoundException("No encontramos el producto a editar.");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_alamcen_products
       SET name = ?, sale_price = ?
       WHERE tenant_id = ?
         AND id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [normalizedName, payload.precioVenta, currentUser.tenantId, productId]
    );

    const updated = await this.findProductRowById(currentUser.tenantId, productId);
    if (!updated) {
      throw new NotFoundException("No encontramos el producto actualizado.");
    }

    return this.mapProductRow(updated);
  }

  async createSale(currentUser: AlamcenRequestUser, payload: CreateAlamcenSaleDto) {
    const normalizedItems = payload.items.map((item) => {
      const nombre = normalizeText(item.nombre, 180);
      if (!nombre) {
        throw new BadRequestException("Cada item necesita nombre.");
      }

      const quantity = Number(item.quantity || 0);
      const precioVenta = Number(item.precioVenta || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException("Cada item necesita una cantidad valida.");
      }
      if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
        throw new BadRequestException("Cada item necesita un precio valido.");
      }

      return {
        productId: item.productId ? Number(item.productId) : null,
        isManual: item.isManual === true || !item.productId,
        nombre,
        unitPrice: roundMoney(precioVenta),
        quantity: roundMoney(quantity),
        lineTotal: roundMoney(precioVenta * quantity),
        imageUrl: item.thumbnailUrl ? String(item.thumbnailUrl).trim() : null
      };
    });

    const totalAmount = roundMoney(normalizedItems.reduce((acc, item) => acc + item.lineTotal, 0));
    const itemsCount = normalizedItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    const externalId = normalizeText(payload.externalId, 120) || null;
    const notes = normalizeText(payload.notes, 255) || null;

    try {
      const saleId = await this.databaseService.withTransaction(async (connection) => {
        const [saleResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO saas_alamcen_sales (
             tenant_id,
             user_id,
             external_id,
             notes,
             total_amount,
             items_count,
             status
           ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed')`,
          [currentUser.tenantId, currentUser.userId, externalId, notes, totalAmount, Math.round(itemsCount)]
        );

        const createdSaleId = Number(saleResult.insertId);
        for (const item of normalizedItems) {
          await connection.execute<ResultSetHeader>(
            `INSERT INTO saas_alamcen_sale_items (
               tenant_id,
               sale_id,
               product_id,
               is_manual,
               product_name,
               unit_price,
               quantity,
               line_total,
               image_url
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              currentUser.tenantId,
              createdSaleId,
              item.productId,
              item.isManual ? 1 : 0,
              item.nombre,
              item.unitPrice,
              item.quantity,
              item.lineTotal,
              item.imageUrl
            ]
          );
        }

        return createdSaleId;
      });

      return {
        ok: true,
        sale: {
          id: saleId,
          externalId,
          totalAmount,
          itemsCount: Math.round(itemsCount),
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "ER_DUP_ENTRY") {
        throw new ConflictException("La venta ya fue registrada.");
      }

      throw error;
    }
  }

  async createPayment(currentUser: AlamcenRequestUser, payload: CreateAlamcenPaymentDto) {
    const amount = roundMoney(payload.amount);
    if (amount <= 0) {
      throw new BadRequestException("El monto debe ser mayor a 0.");
    }

    const externalId = normalizeText(payload.externalId, 120) || null;
    const description = normalizeText(payload.description, 255) || null;

    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_alamcen_payments (
           tenant_id,
           user_id,
           external_id,
           amount,
           description,
           status
         ) VALUES (?, ?, ?, ?, ?, 'confirmed')`,
        [currentUser.tenantId, currentUser.userId, externalId, amount, description]
      );

      return {
        ok: true,
        payment: {
          id: Number(result.insertId),
          externalId,
          amount,
          description,
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "ER_DUP_ENTRY") {
        throw new ConflictException("El pago ya fue registrado.");
      }

      throw error;
    }
  }

  async getDashboard(currentUser: AlamcenRequestUser, query: GetAlamcenDashboardDto) {
    const dateLabel = query.date ? String(query.date).slice(0, 10) : getStoreDateLabel();
    const movementLimit = Number.isInteger(query.movementLimit) ? Number(query.movementLimit) : DEFAULT_MOVEMENT_LIMIT;
    const rankingLimit = Number.isInteger(query.rankingLimit) ? Number(query.rankingLimit) : DEFAULT_RANKING_LIMIT;
    const range = buildBusinessDateRangeUtc(dateLabel);
    const yesterdayLabel = addDaysToDateLabel(dateLabel, -1);
    const yesterdayRange = buildBusinessDateRangeUtc(yesterdayLabel);

    const [
      initialCash,
      salesToday,
      paymentsToday,
      salesYesterday,
      record,
      saleRows,
      paymentRows,
      rankingRows
    ] = await Promise.all([
      query.initialCash != null ? Number(query.initialCash) : this.getInitialCash(currentUser.tenantId, dateLabel),
      this.sumSalesBetween(currentUser.tenantId, range.startIso, range.endIso),
      this.sumPaymentsBetween(currentUser.tenantId, range.startIso, range.endIso),
      this.sumSalesBetween(currentUser.tenantId, yesterdayRange.startIso, yesterdayRange.endIso),
      this.getBestSalesDayTotal(currentUser.tenantId),
      this.listSalesMovements(currentUser.tenantId, range.startIso, range.endIso, movementLimit),
      this.listPaymentMovements(currentUser.tenantId, range.startIso, range.endIso, movementLimit),
      this.listRanking(currentUser.tenantId, range.startIso, range.endIso, rankingLimit)
    ]);

    const saleItems = await this.listSaleItemsBySaleIds(
      currentUser.tenantId,
      saleRows.map((row) => Number(row.id))
    );

    const movements = this.buildMovements(saleRows, saleItems, paymentRows);
    const ranking = rankingRows.map((row) => ({
      key: row.ranking_key,
      name: row.name,
      qty: Number(row.qty || 0),
      thumbnailUrl: row.image_url || null
    }));

    const dashboard: AlamcenDashboardResponse = {
      date: dateLabel,
      metrics: {
        initialCash: roundMoney(initialCash),
        salesToday: roundMoney(salesToday),
        currentAmount: roundMoney(Number(initialCash || 0) + Number(salesToday || 0) - Number(paymentsToday || 0)),
        paymentsTotal: roundMoney(paymentsToday)
      },
      comparison: {
        today: roundMoney(salesToday),
        yesterday: roundMoney(salesYesterday),
        record: roundMoney(Math.max(Number(record || 0), Number(salesToday || 0)))
      },
      movements,
      ranking
    };

    return {
      ok: true,
      dashboard
    };
  }

  private async findProductRowByBarcode(tenantId: number, barcode: string) {
    const rows = await this.databaseService.query<AlamcenProductRow[]>(
      `SELECT
         id,
         tenant_id,
         legacy_product_id,
         name,
         description,
         barcode,
         barcode_normalized,
         sale_price,
         list_price,
         stock_current,
         category,
         image_url,
         status,
         created_at,
         updated_at
       FROM saas_alamcen_products
       WHERE tenant_id = ?
         AND deleted_at IS NULL
         AND (barcode_normalized = ? OR barcode = ?)
       ORDER BY (status = 'active') DESC, id ASC
       LIMIT 1`,
      [tenantId, barcode, barcode]
    );

    return rows[0] ?? null;
  }

  private async findProductRowById(tenantId: number, productId: number) {
    const rows = await this.databaseService.query<AlamcenProductRow[]>(
      `SELECT
         id,
         tenant_id,
         legacy_product_id,
         name,
         description,
         barcode,
         barcode_normalized,
         sale_price,
         list_price,
         stock_current,
         category,
         image_url,
         status,
         created_at,
         updated_at
       FROM saas_alamcen_products
       WHERE tenant_id = ?
         AND id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [tenantId, productId]
    );

    return rows[0] ?? null;
  }

  private mapProductRow(row: AlamcenProductRow): AlamcenProductLookupResponse {
    return {
      id: Number(row.id),
      legacyProductoId: row.legacy_product_id == null ? null : Number(row.legacy_product_id),
      nombre: row.name,
      descripcion: row.description,
      barcode: row.barcode,
      barcodeNormalized: row.barcode_normalized,
      precioVenta: roundMoney(row.sale_price),
      precioLista: row.list_price == null ? null : roundMoney(row.list_price),
      stockActual: Number(row.stock_current || 0),
      categoria: row.category,
      categoriaCompact: row.category,
      categoriaId: null,
      supplierId: null,
      subcategoria: null,
      tieneImagen: Boolean(row.image_url),
      estado: mapProductStatus(row.status),
      imagen: row.image_url,
      createdAt: toCanonicalIsoUtc(row.created_at) || undefined,
      updatedAt: toCanonicalIsoUtc(row.updated_at) || undefined
    };
  }

  private async getInitialCash(tenantId: number, dateLabel: string) {
    const rows = await this.databaseService.query<Array<RowDataPacket & { initial_cash: string | number }>>(
      `SELECT initial_cash
       FROM saas_alamcen_dashboard_daily
       WHERE tenant_id = ?
         AND business_date = ?
       LIMIT 1`,
      [tenantId, dateLabel]
    );

    return rows[0] ? roundMoney(rows[0].initial_cash) : 0;
  }

  private async sumSalesBetween(tenantId: number, startIso: string, endIso: string) {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: string | number }>>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM saas_alamcen_sales
       WHERE tenant_id = ?
         AND status = 'confirmed'
         AND created_at >= ?
         AND created_at < ?`,
      [tenantId, startIso, endIso]
    );

    return roundMoney(rows[0]?.total || 0);
  }

  private async sumPaymentsBetween(tenantId: number, startIso: string, endIso: string) {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: string | number }>>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM saas_alamcen_payments
       WHERE tenant_id = ?
         AND status = 'confirmed'
         AND created_at >= ?
         AND created_at < ?`,
      [tenantId, startIso, endIso]
    );

    return roundMoney(rows[0]?.total || 0);
  }

  private async getBestSalesDayTotal(tenantId: number) {
    const rows = await this.databaseService.query<Array<RowDataPacket & { best_total: string | number }>>(
      `SELECT COALESCE(MAX(day_total), 0) AS best_total
       FROM (
         SELECT DATE(DATE_SUB(created_at, INTERVAL ${STORE_UTC_OFFSET_HOURS} HOUR)) AS business_date, SUM(total_amount) AS day_total
         FROM saas_alamcen_sales
         WHERE tenant_id = ?
           AND status = 'confirmed'
         GROUP BY DATE(DATE_SUB(created_at, INTERVAL ${STORE_UTC_OFFSET_HOURS} HOUR))
       ) grouped_days`,
      [tenantId]
    );

    return roundMoney(rows[0]?.best_total || 0);
  }

  private async listSalesMovements(tenantId: number, startIso: string, endIso: string, limit: number) {
    return this.databaseService.query<SaleRow[]>(
      `SELECT id, total_amount, created_at
       FROM saas_alamcen_sales
       WHERE tenant_id = ?
         AND status = 'confirmed'
         AND created_at >= ?
         AND created_at < ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tenantId, startIso, endIso, limit]
    );
  }

  private async listSaleItemsBySaleIds(tenantId: number, saleIds: number[]) {
    if (!saleIds.length) {
      return [];
    }

    const placeholders = saleIds.map(() => "?").join(", ");
    return this.databaseService.query<SaleItemRow[]>(
      `SELECT sale_id, id, product_name, quantity, line_total
       FROM saas_alamcen_sale_items
       WHERE tenant_id = ?
         AND sale_id IN (${placeholders})
       ORDER BY id ASC`,
      [tenantId, ...saleIds]
    );
  }

  private async listPaymentMovements(tenantId: number, startIso: string, endIso: string, limit: number) {
    return this.databaseService.query<PaymentRow[]>(
      `SELECT id, amount, description, created_at
       FROM saas_alamcen_payments
       WHERE tenant_id = ?
         AND status = 'confirmed'
         AND created_at >= ?
         AND created_at < ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tenantId, startIso, endIso, limit]
    );
  }

  private async listRanking(tenantId: number, startIso: string, endIso: string, limit: number) {
    return this.databaseService.query<RankingRow[]>(
      `SELECT
         CASE
           WHEN sii.product_id IS NULL THEN CONCAT('manual:', sii.product_name)
           ELSE CONCAT('product:', sii.product_id)
         END AS ranking_key,
         MAX(sii.product_name) AS name,
         SUM(sii.quantity) AS qty,
         MAX(COALESCE(sii.image_url, p.image_url)) AS image_url
       FROM saas_alamcen_sale_items sii
       INNER JOIN saas_alamcen_sales ss
         ON ss.id = sii.sale_id
        AND ss.tenant_id = sii.tenant_id
       LEFT JOIN saas_alamcen_products p
         ON p.id = sii.product_id
        AND p.tenant_id = sii.tenant_id
       WHERE ss.tenant_id = ?
         AND ss.status = 'confirmed'
         AND ss.created_at >= ?
         AND ss.created_at < ?
       GROUP BY ranking_key
       ORDER BY qty DESC
       LIMIT ?`,
      [tenantId, startIso, endIso, limit]
    );
  }

  private buildMovements(saleRows: SaleRow[], saleItems: SaleItemRow[], paymentRows: PaymentRow[]) {
    const itemsBySaleId = new Map<number, SaleItemRow[]>();
    saleItems.forEach((item) => {
      const saleId = Number(item.sale_id);
      const current = itemsBySaleId.get(saleId) || [];
      current.push(item);
      itemsBySaleId.set(saleId, current);
    });

    const saleMovements = saleRows.map((sale) => ({
      id: `sale-${sale.id}`,
      type: "Venta" as const,
      amount: roundMoney(sale.total_amount),
      createdAt: toCanonicalIsoUtc(sale.created_at) || new Date().toISOString(),
      detail: {
        kind: "sale" as const,
        operator: "Operario",
        createdAt: toCanonicalIsoUtc(sale.created_at) || new Date().toISOString(),
        items: (itemsBySaleId.get(Number(sale.id)) || []).map((item) => ({
          id: Number(item.id),
          name: item.product_name,
          quantity: Number(item.quantity || 0),
          lineTotal: roundMoney(item.line_total)
        }))
      }
    }));

    const paymentMovements = paymentRows.map((payment) => ({
      id: `payment-${payment.id}`,
      type: "Pago" as const,
      amount: roundMoney(payment.amount) * -1,
      createdAt: toCanonicalIsoUtc(payment.created_at) || new Date().toISOString(),
      detail: {
        kind: "payment" as const,
        description: payment.description || "Pago registrado"
      }
    }));

    return [...saleMovements, ...paymentMovements].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }
}
