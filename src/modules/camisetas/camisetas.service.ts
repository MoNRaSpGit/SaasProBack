import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { buildJerseyImageDataUri } from "./camisetas.images";
import { CamisetaProduct } from "./camisetas.types";

// Catalogo fijo de camisetas genericas (sin marca de ningun equipo real).
// Cuando el catalogo pase a ser dinamico, esto se convierte en una tabla en
// la base como el resto de los modulos.
const CAMISETA_PRODUCTS: CamisetaProduct[] = [
  { id: "cam-01", name: "Camiseta Titular Azul", description: "Corte clasico, azul y blanco, tela liviana transpirable.", price: 1200, currency: "UYU", imageUrl: buildJerseyImageDataUri("#1d4ed8", "#ffffff", 10) },
  { id: "cam-02", name: "Camiseta Suplente Roja", description: "Version alternativa en rojo intenso con detalles negros.", price: 1200, currency: "UYU", imageUrl: buildJerseyImageDataUri("#dc2626", "#111827", 9) },
  { id: "cam-03", name: "Camiseta Retro Verde", description: "Diseño inspirado en los clasicos de los 90, verde y blanco.", price: 1500, currency: "UYU", imageUrl: buildJerseyImageDataUri("#15803d", "#ffffff", 8) },
  { id: "cam-04", name: "Camiseta Titular Negra", description: "Elegante negro y dorado, ideal para coleccionistas.", price: 1600, currency: "UYU", imageUrl: buildJerseyImageDataUri("#111827", "#facc15", 7) },
  { id: "cam-05", name: "Camiseta Celeste Clasica", description: "Celeste y blanco, la combinacion de siempre.", price: 1300, currency: "UYU", imageUrl: buildJerseyImageDataUri("#38bdf8", "#ffffff", 5) },
  { id: "cam-06", name: "Camiseta Naranja Edicion", description: "Edicion especial en naranja vibrante con vivos blancos.", price: 1400, currency: "UYU", imageUrl: buildJerseyImageDataUri("#ea580c", "#ffffff", 11) },
  { id: "cam-07", name: "Camiseta Violeta Fan", description: "Violeta y blanco, para hinchas que buscan algo distinto.", price: 1100, currency: "UYU", imageUrl: buildJerseyImageDataUri("#7c3aed", "#ffffff", 4) },
  { id: "cam-08", name: "Camiseta Rayada Blanca", description: "Blanco y azul marino, estilo rayas verticales.", price: 1250, currency: "UYU", imageUrl: buildJerseyImageDataUri("#f8fafc", "#1e3a8a", 6) },
  { id: "cam-09", name: "Camiseta Bordo Vintage", description: "Bordo con detalles crema, look retro y sobrio.", price: 1550, currency: "UYU", imageUrl: buildJerseyImageDataUri("#7f1d1d", "#fef3c7", 3) },
  { id: "cam-10", name: "Camiseta Amarilla Sol", description: "Amarillo brillante con detalles verdes.", price: 1200, currency: "UYU", imageUrl: buildJerseyImageDataUri("#facc15", "#166534", 12) },
  { id: "cam-11", name: "Camiseta Gris Urbana", description: "Gris moderno con acentos flúor, estilo urbano.", price: 1350, currency: "UYU", imageUrl: buildJerseyImageDataUri("#4b5563", "#a3e635", 14) },
  { id: "cam-12", name: "Camiseta Rosa Edicion Limitada", description: "Rosa fuerte con detalles blancos, edicion limitada.", price: 1700, currency: "UYU", imageUrl: buildJerseyImageDataUri("#db2777", "#ffffff", 17) },
  { id: "cam-13", name: "Camiseta Turquesa Costa", description: "Turquesa fresco con detalles blancos, inspirada en el verano.", price: 1150, currency: "UYU", imageUrl: buildJerseyImageDataUri("#0d9488", "#ffffff", 21) },
  { id: "cam-14", name: "Camiseta Marron Clasica", description: "Marron tierra con vivos beige, diseño sobrio.", price: 1400, currency: "UYU", imageUrl: buildJerseyImageDataUri("#78350f", "#fde68a", 2) },
  { id: "cam-15", name: "Camiseta Azul Marino Elite", description: "Azul marino profundo con detalles plateados.", price: 1650, currency: "UYU", imageUrl: buildJerseyImageDataUri("#1e293b", "#cbd5e1", 15) },
  { id: "cam-16", name: "Camiseta Roja y Negra Ultra", description: "Combinacion clasica roja y negra, corte ajustado.", price: 1500, currency: "UYU", imageUrl: buildJerseyImageDataUri("#b91c1c", "#0f172a", 19) }
];

// A donde vuelve el comprador despues de pagar (o cancelar) en Mercado
// Pago. El front usa HashRouter en produccion (Github Pages), por eso el
// "#/..." en cada ruta.
const DEFAULT_FRONTEND_URL = "https://monraspgit.github.io/frontend-camisetas/";

@Injectable()
export class CamisetasService {
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
}
