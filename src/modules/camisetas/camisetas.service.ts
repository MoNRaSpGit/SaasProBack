import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { buildJerseyImageDataUri } from "./camisetas.images";
import { CamisetaBestSeller, CamisetaPanelSummary, CamisetaProduct, CamisetaSaleMovement } from "./camisetas.types";

// Catalogo fijo de camisetas genericas (sin marca de ningun equipo real).
// Cuando el catalogo pase a ser dinamico, esto se convierte en una tabla en
// la base como el resto de los modulos.
const CAMISETA_PRODUCTS: CamisetaProduct[] = [
  { id: "cam-01", name: "Camiseta Titular Azul", description: "Corte clasico, azul y blanco, tela liviana transpirable.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#1d4ed8", "#ffffff", 10) },
  { id: "cam-02", name: "Camiseta Suplente Roja", description: "Version alternativa en rojo intenso con detalles negros.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#dc2626", "#111827", 9) },
  { id: "cam-03", name: "Camiseta Retro Verde", description: "Diseño inspirado en los clasicos de los 90, verde y blanco.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#15803d", "#ffffff", 8) },
  { id: "cam-04", name: "Camiseta Titular Negra", description: "Elegante negro y dorado, ideal para coleccionistas.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#111827", "#facc15", 7) },
  { id: "cam-05", name: "Camiseta Celeste Clasica", description: "Celeste y blanco, la combinacion de siempre.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#38bdf8", "#ffffff", 5) },
  { id: "cam-06", name: "Camiseta Naranja Edicion", description: "Edicion especial en naranja vibrante con vivos blancos.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#ea580c", "#ffffff", 11) },
  { id: "cam-07", name: "Camiseta Violeta Fan", description: "Violeta y blanco, para hinchas que buscan algo distinto.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#7c3aed", "#ffffff", 4) },
  { id: "cam-08", name: "Camiseta Rayada Blanca", description: "Blanco y azul marino, estilo rayas verticales.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#f8fafc", "#1e3a8a", 6) },
  { id: "cam-09", name: "Camiseta Bordo Vintage", description: "Bordo con detalles crema, look retro y sobrio.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#7f1d1d", "#fef3c7", 3) },
  { id: "cam-10", name: "Camiseta Amarilla Sol", description: "Amarillo brillante con detalles verdes.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#facc15", "#166534", 12) },
  { id: "cam-11", name: "Camiseta Gris Urbana", description: "Gris moderno con acentos flúor, estilo urbano.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#4b5563", "#a3e635", 14) },
  { id: "cam-12", name: "Camiseta Rosa Edicion Limitada", description: "Rosa fuerte con detalles blancos, edicion limitada.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#db2777", "#ffffff", 17) },
  { id: "cam-13", name: "Camiseta Turquesa Costa", description: "Turquesa fresco con detalles blancos, inspirada en el verano.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#0d9488", "#ffffff", 21) },
  { id: "cam-14", name: "Camiseta Marron Clasica", description: "Marron tierra con vivos beige, diseño sobrio.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#78350f", "#fde68a", 2) },
  { id: "cam-15", name: "Camiseta Azul Marino Elite", description: "Azul marino profundo con detalles plateados.", price: 10, currency: "UYU", imageUrl: buildJerseyImageDataUri("#1e293b", "#cbd5e1", 15) },
  { id: "cam-16", name: "Camiseta Roja y Negra Ultra", description: "Combinacion clasica roja y negra, corte ajustado.", price: 20, currency: "UYU", imageUrl: buildJerseyImageDataUri("#b91c1c", "#0f172a", 19) }
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
