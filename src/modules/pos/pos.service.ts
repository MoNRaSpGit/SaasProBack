import { BadRequestException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { CreatePosPaymentDto } from "./dto/create-pos-payment.dto";
import { CreatePosProductDto } from "./dto/create-pos-product.dto";
import { CreatePosSaleDto, CreatePosSaleItemInput } from "./dto/create-pos-sale.dto";
import { GetPosDashboardDto } from "./dto/get-pos-dashboard.dto";
import { ListPosPaymentsDto } from "./dto/list-pos-payments.dto";
import { ListPosProductsDto } from "./dto/list-pos-products.dto";
import { ListPosSalesDto } from "./dto/list-pos-sales.dto";
import { LookupPosProductDto } from "./dto/lookup-pos-product.dto";
import { PosRequestUser } from "./pos.types";

type PosProductRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  sale_price: string;
  cost_price: string | null;
  image_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type PosSaleRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  user_id: number;
  external_id: string | null;
  notes: string | null;
  items_count: number;
  total_amount: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type PosSaleItemRow = RowDataPacket & {
  id: number;
  sale_id: number;
  tenant_id: number;
  product_id: number | null;
  is_manual: number;
  product_name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  barcode: string | null;
  sku: string | null;
  image_url: string | null;
  created_at: string;
};

type PosPaymentRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  user_id: number;
  external_id: string | null;
  amount: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type DashboardMetricsRow = RowDataPacket & {
  sales_total: string | null;
  tickets_count: number | null;
  items_sold: number | null;
};

type DashboardPaymentsRow = RowDataPacket & {
  payments_total: string | null;
};

type DashboardRankingRow = RowDataPacket & {
  product_name: string;
  qty: number;
};

@Injectable()
export class PosService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProducts(currentUser: PosRequestUser, query: ListPosProductsDto) {
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const whereParts = ["tenant_id = ?", "is_active = 1"];
    const values: Array<string | number> = [currentUser.tenantId];

    if (search) {
      whereParts.push("(name LIKE ? OR sku LIKE ? OR barcode LIKE ?)");
      const likeValue = `%${search}%`;
      values.push(likeValue, likeValue, likeValue);
    }

    values.push(limit);

    const rows = await this.databaseService.query<PosProductRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         sku,
         barcode,
         sale_price,
         cost_price,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM saas_pos_products
       WHERE ${whereParts.join(" AND ")}
       ORDER BY name ASC
       LIMIT ?`,
      values
    );

    return {
      items: rows.map((row) => this.mapProduct(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length,
        limit
      }
    };
  }

  async lookupProduct(currentUser: PosRequestUser, query: LookupPosProductDto) {
    const barcode = query.barcode?.trim();
    const sku = query.sku?.trim();

    if ((!barcode && !sku) || (barcode && sku)) {
      throw new BadRequestException("Debes enviar solo uno: barcode o sku");
    }

    const field = barcode ? "barcode" : "sku";
    const value = barcode || sku;

    const rows = await this.databaseService.query<PosProductRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         name,
         sku,
         barcode,
         sale_price,
         cost_price,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM saas_pos_products
       WHERE tenant_id = ?
         AND is_active = 1
         AND ${field} = ?
       LIMIT 1`,
      [currentUser.tenantId, value]
    );

    const row = rows[0];

    return {
      found: Boolean(row),
      item: row ? this.mapProduct(row) : null,
      lookup: {
        field,
        value,
        tenantId: currentUser.tenantId
      }
    };
  }

  async createProduct(currentUser: PosRequestUser, dto: CreatePosProductDto) {
    const name = dto.name.trim();
    const sku = dto.sku?.trim() || null;
    const barcode = dto.barcode?.trim() || null;
    const imageUrl = dto.imageUrl?.trim() || null;
    const salePrice = Number(dto.salePrice.toFixed(2));
    const costPrice = dto.costPrice == null ? null : Number(dto.costPrice.toFixed(2));

    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_pos_products (
           tenant_id,
           branch_id,
           name,
           sku,
           barcode,
           sale_price,
           cost_price,
           image_url,
           is_active
         )
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1)`,
        [currentUser.tenantId, name, sku, barcode, salePrice, costPrice, imageUrl]
      );

      const rows = await this.databaseService.query<PosProductRow[]>(
        `SELECT
           id,
           tenant_id,
           branch_id,
           name,
           sku,
           barcode,
           sale_price,
           cost_price,
           image_url,
           is_active,
           created_at,
           updated_at
         FROM saas_pos_products
         WHERE id = ? AND tenant_id = ?
         LIMIT 1`,
        [result.insertId, currentUser.tenantId]
      );

      return {
        item: this.mapProduct(rows[0])
      };
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      if (dbError.code === "ER_DUP_ENTRY") {
        throw new BadRequestException("SKU o barcode ya existe para este tenant");
      }

      throw error;
    }
  }

  async listSales(currentUser: PosRequestUser, query: ListPosSalesDto) {
    const limit = query.limit ?? 20;

    const sales = await this.databaseService.query<PosSaleRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         user_id,
         external_id,
         notes,
         items_count,
         total_amount,
         status,
         created_at,
         updated_at
       FROM saas_pos_sales
       WHERE tenant_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [currentUser.tenantId, limit]
    );

    if (sales.length === 0) {
      return {
        items: [],
        meta: {
          tenantId: currentUser.tenantId,
          count: 0,
          limit
        }
      };
    }

    const saleIds = sales.map((sale) => sale.id);
    const items = await this.databaseService.query<PosSaleItemRow[]>(
      `SELECT
         id,
         sale_id,
         tenant_id,
         product_id,
         is_manual,
         product_name,
         unit_price,
         quantity,
         line_total,
         barcode,
         sku,
         image_url,
         created_at
       FROM saas_pos_sale_items
       WHERE tenant_id = ?
         AND sale_id IN (${saleIds.map(() => "?").join(", ")})
       ORDER BY sale_id ASC, id ASC`,
      [currentUser.tenantId, ...saleIds]
    );

    const itemsBySaleId = new Map<number, PosSaleItemRow[]>();
    for (const item of items) {
      const bucket = itemsBySaleId.get(item.sale_id) || [];
      bucket.push(item);
      itemsBySaleId.set(item.sale_id, bucket);
    }

    return {
      items: sales.map((sale) => this.mapSale(sale, itemsBySaleId.get(sale.id) || [])),
      meta: {
        tenantId: currentUser.tenantId,
        count: sales.length,
        limit
      }
    };
  }

  async createSale(currentUser: PosRequestUser, dto: CreatePosSaleDto) {
    const externalId = dto.externalId?.trim() || null;
    const notes = dto.notes?.trim() || null;

    return this.databaseService.withTransaction(async (connection) => {
      const normalizedItems = await this.normalizeSaleItems(connection, currentUser, dto.items);
      const itemsCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = Number(
        normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
      );

      try {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO saas_pos_sales (
             tenant_id,
             branch_id,
             user_id,
             external_id,
             notes,
             items_count,
             total_amount,
             status
           )
           VALUES (?, NULL, ?, ?, ?, ?, ?, 'confirmed')`,
          [currentUser.tenantId, currentUser.userId, externalId, notes, itemsCount, totalAmount]
        );

        const saleId = result.insertId;

        for (const item of normalizedItems) {
          await connection.execute(
            `INSERT INTO saas_pos_sale_items (
               sale_id,
               tenant_id,
               product_id,
               is_manual,
               product_name,
               unit_price,
               quantity,
               line_total,
               barcode,
               sku,
               image_url
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              currentUser.tenantId,
              item.productId,
              item.isManual ? 1 : 0,
              item.name,
              item.unitPrice,
              item.quantity,
              item.lineTotal,
              item.barcode,
              item.sku,
              item.imageUrl
            ]
          );
        }

        const saleRows = await this.fetchSalesByIds(connection, currentUser.tenantId, [saleId]);
        const itemRows = await this.fetchSaleItemsBySaleIds(connection, currentUser.tenantId, [saleId]);

        return {
          sale: this.mapSale(saleRows[0], itemRows)
        };
      } catch (error: unknown) {
        const dbError = error as { code?: string };
        if (dbError.code === "ER_DUP_ENTRY") {
          throw new BadRequestException("externalId ya existe para este tenant");
        }

        throw error;
      }
    });
  }

  async listPayments(currentUser: PosRequestUser, query: ListPosPaymentsDto) {
    const limit = query.limit ?? 20;
    const rows = await this.databaseService.query<PosPaymentRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         user_id,
         external_id,
         amount,
         description,
         status,
         created_at,
         updated_at
       FROM saas_pos_payments
       WHERE tenant_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [currentUser.tenantId, limit]
    );

    return {
      items: rows.map((row) => this.mapPayment(row)),
      meta: {
        tenantId: currentUser.tenantId,
        count: rows.length,
        limit
      }
    };
  }

  async createPayment(currentUser: PosRequestUser, dto: CreatePosPaymentDto) {
    const externalId = dto.externalId?.trim() || null;
    const description = dto.description?.trim() || null;
    const amount = Number(dto.amount.toFixed(2));

    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_pos_payments (
           tenant_id,
           branch_id,
           user_id,
           external_id,
           amount,
           description,
           status
         )
         VALUES (?, NULL, ?, ?, ?, ?, 'confirmed')`,
        [currentUser.tenantId, currentUser.userId, externalId, amount, description]
      );

      const rows = await this.databaseService.query<PosPaymentRow[]>(
        `SELECT
           id,
           tenant_id,
           branch_id,
           user_id,
           external_id,
           amount,
           description,
           status,
           created_at,
           updated_at
         FROM saas_pos_payments
         WHERE id = ? AND tenant_id = ?
         LIMIT 1`,
        [result.insertId, currentUser.tenantId]
      );

      return {
        payment: this.mapPayment(rows[0])
      };
    } catch (error: unknown) {
      const dbError = error as { code?: string };
      if (dbError.code === "ER_DUP_ENTRY") {
        throw new BadRequestException("externalId ya existe para este tenant");
      }

      throw error;
    }
  }

  async getDashboard(currentUser: PosRequestUser, query: GetPosDashboardDto) {
    const movementLimit = query.movementLimit ?? 10;
    const rankingLimit = query.rankingLimit ?? 5;

    const salesMetricsRows = await this.databaseService.query<DashboardMetricsRow[]>(
      `SELECT
         COALESCE(SUM(total_amount), 0) AS sales_total,
         COUNT(*) AS tickets_count,
         COALESCE(SUM(items_count), 0) AS items_sold
       FROM saas_pos_sales
       WHERE tenant_id = ?
         AND status = 'confirmed'`,
      [currentUser.tenantId]
    );
    const paymentsMetricRows = await this.databaseService.query<DashboardPaymentsRow[]>(
      `SELECT COALESCE(SUM(amount), 0) AS payments_total
       FROM saas_pos_payments
       WHERE tenant_id = ?
         AND status = 'confirmed'`,
      [currentUser.tenantId]
    );

    const salesRows = await this.databaseService.query<PosSaleRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         user_id,
         external_id,
         notes,
         items_count,
         total_amount,
         status,
         created_at,
         updated_at
       FROM saas_pos_sales
       WHERE tenant_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [currentUser.tenantId, movementLimit]
    );
    const paymentRows = await this.databaseService.query<PosPaymentRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         user_id,
         external_id,
         amount,
         description,
         status,
         created_at,
         updated_at
       FROM saas_pos_payments
       WHERE tenant_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [currentUser.tenantId, movementLimit]
    );

    const rankingRows = await this.databaseService.query<DashboardRankingRow[]>(
      `SELECT
         product_name,
         SUM(quantity) AS qty
       FROM saas_pos_sale_items
       WHERE tenant_id = ?
       GROUP BY product_name
       ORDER BY qty DESC, product_name ASC
       LIMIT ?`,
      [currentUser.tenantId, rankingLimit]
    );

    const salesMetrics = salesMetricsRows[0];
    const paymentsMetrics = paymentsMetricRows[0];
    const salesTotal = Number(salesMetrics?.sales_total || 0);
    const paymentsTotal = Number(paymentsMetrics?.payments_total || 0);

    const movements = [
      ...salesRows.map((sale) => ({
        id: `sale-${sale.id}`,
        type: "sale" as const,
        amount: Number(sale.total_amount),
        createdAt: sale.created_at,
        detail: {
          saleId: sale.id,
          itemsCount: sale.items_count,
          notes: sale.notes
        }
      })),
      ...paymentRows.map((payment) => ({
        id: `payment-${payment.id}`,
        type: "payment" as const,
        amount: -Number(payment.amount),
        createdAt: payment.created_at,
        detail: {
          paymentId: payment.id,
          description: payment.description
        }
      }))
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, movementLimit);

    return {
      tenant: {
        id: currentUser.tenantId,
        name: currentUser.tenantName,
        slug: currentUser.tenantSlug
      },
      metrics: {
        salesTotal,
        paymentsTotal,
        balance: Number((salesTotal - paymentsTotal).toFixed(2)),
        ticketsCount: Number(salesMetrics?.tickets_count || 0),
        itemsSold: Number(salesMetrics?.items_sold || 0)
      },
      movements,
      ranking: rankingRows.map((row) => ({
        name: row.product_name,
        qty: Number(row.qty)
      }))
    };
  }

  private mapProduct(row: PosProductRow | undefined) {
    if (!row) {
      throw new BadRequestException("Producto no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      salePrice: Number(row.sale_price),
      costPrice: row.cost_price == null ? null : Number(row.cost_price),
      imageUrl: row.image_url,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private async normalizeSaleItems(
    connection: PoolConnection,
    currentUser: PosRequestUser,
    items: CreatePosSaleItemInput[]
  ) {
    const normalized: Array<{
      productId: number | null;
      isManual: boolean;
      name: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      barcode: string | null;
      sku: string | null;
      imageUrl: string | null;
    }> = [];

    for (const rawItem of items) {
      const quantity = rawItem.quantity;
      const isManual = Boolean(rawItem.isManual) || !rawItem.productId;
      const inputName = rawItem.name.trim();
      const inputUnitPrice = Number(rawItem.unitPrice.toFixed(2));

      if (rawItem.productId) {
        const [product] = await connection.query<PosProductRow[]>(
          `SELECT
             id,
             tenant_id,
             branch_id,
             name,
             sku,
             barcode,
             sale_price,
             cost_price,
             image_url,
             is_active,
             created_at,
             updated_at
           FROM saas_pos_products
           WHERE id = ?
             AND tenant_id = ?
             AND is_active = 1
           LIMIT 1`,
          [rawItem.productId, currentUser.tenantId]
        );

        const productRow = product[0];
        if (!productRow) {
          throw new BadRequestException(`Producto ${rawItem.productId} no encontrado para este tenant`);
        }

        const productName = inputName || productRow.name;
        const unitPrice = inputUnitPrice > 0 ? inputUnitPrice : Number(productRow.sale_price);

        normalized.push({
          productId: productRow.id,
          isManual,
          name: productName,
          unitPrice,
          quantity,
          lineTotal: Number((unitPrice * quantity).toFixed(2)),
          barcode: rawItem.barcode?.trim() || productRow.barcode,
          sku: rawItem.sku?.trim() || productRow.sku,
          imageUrl: rawItem.imageUrl?.trim() || productRow.image_url
        });

        continue;
      }

      normalized.push({
        productId: null,
        isManual: true,
        name: inputName,
        unitPrice: inputUnitPrice,
        quantity,
        lineTotal: Number((inputUnitPrice * quantity).toFixed(2)),
        barcode: rawItem.barcode?.trim() || null,
        sku: rawItem.sku?.trim() || null,
        imageUrl: rawItem.imageUrl?.trim() || null
      });
    }

    return normalized;
  }

  private async fetchSalesByIds(connection: PoolConnection, tenantId: number, saleIds: number[]) {
    const [rows] = await connection.query<PosSaleRow[]>(
      `SELECT
         id,
         tenant_id,
         branch_id,
         user_id,
         external_id,
         notes,
         items_count,
         total_amount,
         status,
         created_at,
         updated_at
       FROM saas_pos_sales
       WHERE tenant_id = ?
         AND id IN (${saleIds.map(() => "?").join(", ")})
       ORDER BY created_at DESC, id DESC`,
      [tenantId, ...saleIds]
    );

    return rows;
  }

  private async fetchSaleItemsBySaleIds(connection: PoolConnection, tenantId: number, saleIds: number[]) {
    const [rows] = await connection.query<PosSaleItemRow[]>(
      `SELECT
         id,
         sale_id,
         tenant_id,
         product_id,
         is_manual,
         product_name,
         unit_price,
         quantity,
         line_total,
         barcode,
         sku,
         image_url,
         created_at
       FROM saas_pos_sale_items
       WHERE tenant_id = ?
         AND sale_id IN (${saleIds.map(() => "?").join(", ")})
       ORDER BY sale_id ASC, id ASC`,
      [tenantId, ...saleIds]
    );

    return rows;
  }

  private mapSale(row: PosSaleRow | undefined, items: PosSaleItemRow[]) {
    if (!row) {
      throw new BadRequestException("Venta no encontrada");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      userId: row.user_id,
      externalId: row.external_id,
      notes: row.notes,
      itemsCount: row.items_count,
      totalAmount: Number(row.total_amount),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: items.map((item) => ({
        id: item.id,
        saleId: item.sale_id,
        tenantId: item.tenant_id,
        productId: item.product_id,
        isManual: Boolean(item.is_manual),
        name: item.product_name,
        unitPrice: Number(item.unit_price),
        quantity: item.quantity,
        lineTotal: Number(item.line_total),
        barcode: item.barcode,
        sku: item.sku,
        imageUrl: item.image_url,
        createdAt: item.created_at
      }))
    };
  }

  private mapPayment(row: PosPaymentRow | undefined) {
    if (!row) {
      throw new BadRequestException("Pago no encontrado");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      userId: row.user_id,
      externalId: row.external_id,
      amount: Number(row.amount),
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
