import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { CamisetaBestSeller, CamisetaPanelSummary, CamisetaProduct, CamisetaSaleMovement } from "./camisetas.types";

// Catalogo fijo con las camisetas reales que subio el cliente. Las imagenes
// viven en frontend-camisetas/public/camisetas/ y se sirven como ruta
// relativa (el front le antepone su base URL, que cambia entre dev y
// Github Pages). Cuando el catalogo pase a ser dinamico, esto se convierte
// en una tabla en la base como el resto de los modulos.
const CAMISETA_PRODUCTS: CamisetaProduct[] = [
  { id: "barcelona", name: "Camiseta Barcelona", description: "Camiseta titular del Barcelona, corte clasico y tela liviana transpirable.", price: 10, currency: "UYU", imageUrl: "camisetas/barcelona.jpg" },
  { id: "boca", name: "Camiseta Boca Juniors", description: "Camiseta titular de Boca Juniors, azul y oro, para hinchas de La Bombonera.", price: 20, currency: "UYU", imageUrl: "camisetas/boca.jpg" },
  { id: "botafogo", name: "Camiseta Botafogo", description: "Camiseta a rayas blancas y negras del Botafogo, estilo clasico brasileño.", price: 10, currency: "UYU", imageUrl: "camisetas/botafogo.jpg" },
  { id: "milan", name: "Camiseta Milan", description: "Camiseta titular del Milan, rojo y negro, corte ajustado.", price: 20, currency: "UYU", imageUrl: "camisetas/milan.jpg" },
  { id: "nacional", name: "Camiseta Nacional", description: "Camiseta tricolor de Nacional, un clasico del futbol uruguayo.", price: 10, currency: "UYU", imageUrl: "camisetas/nacional.jpg" },
  { id: "penarol", name: "Camiseta Peñarol", description: "Camiseta a rayas amarillas y negras de Peñarol, la garra charrua.", price: 20, currency: "UYU", imageUrl: "camisetas/penarol.jpg" },
  { id: "river", name: "Camiseta River Plate", description: "Camiseta titular de River Plate, banda roja sobre blanco.", price: 10, currency: "UYU", imageUrl: "camisetas/river.jpg" },
  { id: "real-madrid", name: "Camiseta Real Madrid", description: "Camiseta titular del Real Madrid, blanca con detalles dorados.", price: 20, currency: "UYU", imageUrl: "camisetas/real-madrid.jpg" }
];

// A donde vuelve el comprador despues de pagar (o cancelar) en Mercado
// Pago. El front usa HashRouter en produccion (Github Pages), por eso el
// "#/..." en cada ruta.
const DEFAULT_FRONTEND_URL = "https://monraspgit.github.io/frontend-camisetas/";

// A donde Mercado Pago manda la notificacion de pago (webhook/IPN).
const DEFAULT_BACKEND_URL = "https://saasproback.onrender.com";

type SaleRow = RowDataPacket & {
  id: number;
  product_id: string;
  product_name: string;
  unit_price: string;
  currency: string;
  mp_payment_id: string;
  mp_status: string;
  created_at: string;
};

@Injectable()
export class CamisetasService {
  private readonly logger = new Logger(CamisetasService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  getProducts(): { items: CamisetaProduct[] } {
    return { items: CAMISETA_PRODUCTS };
  }

  private findProduct(productId: string): CamisetaProduct {
    const product = CAMISETA_PRODUCTS.find((item) => item.id === productId);
    if (!product) {
      throw new NotFoundException("La camiseta seleccionada no existe.");
    }
    return product;
  }

  async createCheckoutPreference(productId: string): Promise<{ initPoint: string }> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new BadRequestException("MP_ACCESS_TOKEN no esta configurado en el servidor.");
    }

    const product = this.findProduct(productId);

    const frontendUrl = (process.env.CAMISETAS_FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/$/, "");
    const backendUrl = (process.env.CAMISETAS_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: product.id,
            title: product.name,
            description: product.description,
            quantity: 1,
            currency_id: product.currency,
            unit_price: product.price
          }
        ],
        external_reference: product.id,
        notification_url: `${backendUrl}/api/v1/camisetas/webhook`,
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
  // Solo nos interesan los pagos aprobados; se guardan una sola vez gracias
  // al UNIQUE de mp_payment_id (ON DUPLICATE KEY = no-op).
  async handlePaymentNotification(paymentId: string | undefined): Promise<void> {
    if (!paymentId) return;

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return;

    try {
      const client = new MercadoPagoConfig({ accessToken });
      const payment = await new Payment(client).get({ id: paymentId });

      if (payment.status !== "approved") return;

      const productId = payment.external_reference;
      if (!productId) return;

      const product = CAMISETA_PRODUCTS.find((item) => item.id === productId);
      if (!product) return;

      await this.databaseService.execute(
        `INSERT INTO saas_camisetas_sales
           (product_id, product_name, unit_price, currency, mp_payment_id, mp_preference_id, mp_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mp_status = VALUES(mp_status)`,
        [
          product.id,
          product.name,
          product.price,
          product.currency,
          String(payment.id),
          payment.order?.id ? String(payment.order.id) : null,
          payment.status
        ]
      );
    } catch (error) {
      this.logger.error(`No se pudo procesar la notificacion de pago ${paymentId}`, error as Error);
    }
  }

  async getPanelSummary(): Promise<CamisetaPanelSummary> {
    const rows = await this.databaseService.query<SaleRow[]>(
      `SELECT id, product_id, product_name, unit_price, currency, mp_payment_id, mp_status, created_at
       FROM saas_camisetas_sales
       WHERE mp_status = 'approved'
       ORDER BY created_at DESC`
    );

    const movimientos: CamisetaSaleMovement[] = rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      unitPrice: Number(row.unit_price),
      currency: row.currency,
      mpPaymentId: row.mp_payment_id,
      mpStatus: row.mp_status,
      createdAt: new Date(row.created_at).toISOString()
    }));

    const currency = movimientos[0]?.currency || "UYU";
    const totalVendido = movimientos.reduce((sum, sale) => sum + sale.unitPrice, 0);

    const salesByProduct = new Map<string, CamisetaBestSeller>();
    for (const sale of movimientos) {
      const existing = salesByProduct.get(sale.productId);
      if (existing) {
        existing.unitsSold += 1;
        existing.totalVendido += sale.unitPrice;
      } else {
        salesByProduct.set(sale.productId, {
          productId: sale.productId,
          productName: sale.productName,
          unitsSold: 1,
          totalVendido: sale.unitPrice
        });
      }
    }

    const masVendidas = Array.from(salesByProduct.values()).sort((a, b) => b.unitsSold - a.unitsSold);

    return {
      totalVendido,
      // No hay costo de producto cargado (son camisetas de prueba), por eso
      // la ganancia es igual al total vendido: no hay margen a descontar.
      totalGanancia: totalVendido,
      cantidadVentas: movimientos.length,
      currency,
      movimientos,
      masVendidas
    };
  }
}
