import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { CamisetaCheckoutItemDto } from "./dto/create-camisetas-checkout.dto";
import { UpdateCamisetasProductDto } from "./dto/update-camisetas-product.dto";
import {
  CamisetaBestSeller,
  CamisetaPanelSummary,
  CamisetaPendingOrderItem,
  CamisetaProduct,
  CamisetaSaleMovement
} from "./camisetas.types";

// A donde vuelve el comprador despues de pagar (o cancelar) en Mercado
// Pago. El front usa HashRouter en produccion (Github Pages), por eso el
// "#/..." en cada ruta.
const DEFAULT_FRONTEND_URL = "https://monraspgit.github.io/frontend-camisetas/";

// A donde Mercado Pago manda la notificacion de pago (webhook/IPN), y de
// donde el front arma la URL de la imagen subida (GET .../products/:id/image).
const DEFAULT_BACKEND_URL = "https://saasproback.onrender.com";

// Limite duro del lado del servidor. El frontend ya comprime/redimensiona
// antes de mandar, esto es solo una red de seguridad por si alguien pega
// el data URI directo a la API.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProductRow = RowDataPacket & {
  id: string;
  name: string;
  description: string;
  price: string;
  sale_price: string | null;
  currency: string;
  static_image_path: string | null;
  has_image: number;
};

type ProductImageRow = RowDataPacket & {
  image_data: Buffer;
  mime_type: string;
  source_hash: string;
};

type SaleRow = RowDataPacket & {
  id: number;
  product_id: string;
  product_name: string;
  unit_price: string;
  quantity: number;
  currency: string;
  mp_payment_id: string;
  mp_status: string;
  created_at: string;
};

type PendingOrderRow = RowDataPacket & {
  order_ref: string;
  items_json: string;
};

function parseImageDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function backendUrl() {
  return (process.env.CAMISETAS_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

@Injectable()
export class CamisetasService {
  private readonly logger = new Logger(CamisetasService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private mapProduct(row: ProductRow): CamisetaProduct {
    const imageUrl = row.has_image
      ? `${backendUrl()}/api/v1/camisetas/products/${row.id}/image`
      : row.static_image_path || "";

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
      currency: row.currency,
      imageUrl
    };
  }

  async getProducts(): Promise<{ items: CamisetaProduct[] }> {
    const rows = await this.databaseService.query<ProductRow[]>(
      `SELECT id, name, description, price, sale_price, currency, static_image_path, has_image
       FROM saas_camisetas_products
       ORDER BY id`
    );
    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  private async findProductRow(productId: string): Promise<ProductRow> {
    const rows = await this.databaseService.query<ProductRow[]>(
      `SELECT id, name, description, price, sale_price, currency, static_image_path, has_image
       FROM saas_camisetas_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );

    if (!rows[0]) {
      throw new NotFoundException("La camiseta seleccionada no existe.");
    }

    return rows[0];
  }

  async updateProduct(productId: string, dto: UpdateCamisetasProductDto): Promise<CamisetaProduct> {
    await this.findProductRow(productId);

    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    if (dto.name !== undefined) {
      fields.push("name = ?");
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      fields.push("description = ?");
      values.push(dto.description);
    }
    if (dto.price !== undefined) {
      fields.push("price = ?");
      values.push(dto.price);
    }
    if (dto.salePrice !== undefined) {
      fields.push("sale_price = ?");
      values.push(dto.salePrice);
    }

    if (fields.length > 0) {
      await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_camisetas_products SET ${fields.join(", ")} WHERE id = ?`,
        [...values, productId]
      );
    }

    const row = await this.findProductRow(productId);
    return this.mapProduct(row);
  }

  async getProductImage(productId: string): Promise<{ buffer: Buffer; mimeType: string; sourceHash: string } | null> {
    const rows = await this.databaseService.query<ProductImageRow[]>(
      `SELECT image_data, mime_type, source_hash FROM saas_camisetas_product_images WHERE product_id = ? LIMIT 1`,
      [productId]
    );

    if (!rows[0]) return null;

    return { buffer: rows[0].image_data, mimeType: rows[0].mime_type, sourceHash: rows[0].source_hash };
  }

  async setProductImage(productId: string, dataUri: string): Promise<void> {
    await this.findProductRow(productId);

    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 valido.");
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(parsed.mimeType)) {
      throw new BadRequestException("Formato de imagen no soportado. Usa JPG, PNG o WEBP.");
    }

    if (parsed.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException("Esta imagen es demasiado pesada. Probá con una más liviana.");
    }

    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_camisetas_product_images (product_id, image_data, mime_type, source_hash, byte_size)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         image_data = VALUES(image_data),
         mime_type = VALUES(mime_type),
         source_hash = VALUES(source_hash),
         byte_size = VALUES(byte_size)`,
      [productId, parsed.buffer, parsed.mimeType, sourceHash, parsed.buffer.length]
    );

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_camisetas_products SET has_image = 1 WHERE id = ?`,
      [productId]
    );
  }

  async createCheckoutPreference(items: CamisetaCheckoutItemDto[]): Promise<{ initPoint: string }> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new BadRequestException("MP_ACCESS_TOKEN no esta configurado en el servidor.");
    }

    // Los precios y nombres salen SIEMPRE de la base (nunca de lo que mande
    // el cliente), para que nadie pueda pagar menos manipulando el pedido.
    const orderItems: CamisetaPendingOrderItem[] = [];
    for (const item of items) {
      const row = await this.findProductRow(item.productId);
      const product = this.mapProduct(row);
      orderItems.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.salePrice ?? product.price,
        quantity: item.quantity,
        currency: product.currency
      });
    }

    const currency = orderItems[0].currency;
    const orderRef = randomUUID();

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_camisetas_pending_orders (order_ref, items_json) VALUES (?, ?)`,
      [orderRef, JSON.stringify(orderItems)]
    );

    const frontendUrl = (process.env.CAMISETAS_FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/$/, "");

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: orderItems.map((item) => ({
          id: item.productId,
          title: item.productName,
          quantity: item.quantity,
          currency_id: item.currency,
          unit_price: item.unitPrice
        })),
        external_reference: orderRef,
        notification_url: `${backendUrl()}/api/v1/camisetas/webhook`,
        back_urls: {
          success: `${frontendUrl}/#/compra-exitosa`,
          pending: `${frontendUrl}/#/compra-pendiente`,
          failure: `${frontendUrl}/#/compra-fallida`
        },
        auto_return: "approved"
      }
    });

    if (!result.init_point) {
      throw new BadRequestException("Mercado Pago no devolvio un link de pago.");
    }

    return { initPoint: result.init_point };
  }

  // Mercado Pago llama esta ruta cuando cambia el estado de un pago (IPN).
  // Solo nos interesan los pagos aprobados; cada linea del carrito se guarda
  // una sola vez gracias al UNIQUE (mp_payment_id, product_id).
  async handlePaymentNotification(paymentId: string | undefined): Promise<void> {
    if (!paymentId) return;

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return;

    try {
      const client = new MercadoPagoConfig({ accessToken });
      const payment = await new Payment(client).get({ id: paymentId });

      if (payment.status !== "approved") return;

      const orderRef = payment.external_reference;
      if (!orderRef) return;

      const pendingRows = await this.databaseService.query<PendingOrderRow[]>(
        `SELECT order_ref, items_json FROM saas_camisetas_pending_orders WHERE order_ref = ? LIMIT 1`,
        [orderRef]
      );

      if (!pendingRows[0]) {
        this.logger.warn(`No se encontro el carrito ${orderRef} para el pago ${paymentId}.`);
        return;
      }

      const items = JSON.parse(pendingRows[0].items_json) as CamisetaPendingOrderItem[];

      for (const item of items) {
        await this.databaseService.execute(
          `INSERT INTO saas_camisetas_sales
             (product_id, product_name, unit_price, quantity, currency, mp_payment_id, mp_preference_id, mp_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE mp_status = VALUES(mp_status), quantity = VALUES(quantity)`,
          [
            item.productId,
            item.productName,
            item.unitPrice,
            item.quantity,
            item.currency,
            String(payment.id),
            payment.order?.id ? String(payment.order.id) : null,
            payment.status
          ]
        );
      }
    } catch (error) {
      this.logger.error(`No se pudo procesar la notificacion de pago ${paymentId}`, error as Error);
    }
  }

  async getPanelSummary(): Promise<CamisetaPanelSummary> {
    const rows = await this.databaseService.query<SaleRow[]>(
      `SELECT id, product_id, product_name, unit_price, quantity, currency, mp_payment_id, mp_status, created_at
       FROM saas_camisetas_sales
       WHERE mp_status = 'approved'
       ORDER BY created_at DESC`
    );

    const movimientos: CamisetaSaleMovement[] = rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      unitPrice: Number(row.unit_price),
      quantity: row.quantity,
      currency: row.currency,
      mpPaymentId: row.mp_payment_id,
      mpStatus: row.mp_status,
      createdAt: new Date(row.created_at).toISOString()
    }));

    const currency = movimientos[0]?.currency || "UYU";
    const totalVendido = movimientos.reduce((sum, sale) => sum + sale.unitPrice * sale.quantity, 0);
    const cantidadVentas = movimientos.reduce((sum, sale) => sum + sale.quantity, 0);

    const salesByProduct = new Map<string, CamisetaBestSeller>();
    for (const sale of movimientos) {
      const existing = salesByProduct.get(sale.productId);
      const lineTotal = sale.unitPrice * sale.quantity;
      if (existing) {
        existing.unitsSold += sale.quantity;
        existing.totalVendido += lineTotal;
      } else {
        salesByProduct.set(sale.productId, {
          productId: sale.productId,
          productName: sale.productName,
          unitsSold: sale.quantity,
          totalVendido: lineTotal
        });
      }
    }

    const masVendidas = Array.from(salesByProduct.values()).sort((a, b) => b.unitsSold - a.unitsSold);

    return {
      totalVendido,
      // No hay costo de producto cargado (son camisetas de prueba), por eso
      // la ganancia es igual al total vendido: no hay margen a descontar.
      totalGanancia: totalVendido,
      cantidadVentas,
      currency,
      movimientos,
      masVendidas
    };
  }
}
