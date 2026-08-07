import { BadRequestException, Injectable } from "@nestjs/common";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { CamisetaProduct } from "./camisetas.types";

// Un solo producto por ahora (el objetivo de esta etapa es probar el pago
// por Mercado Pago, no el catalogo completo). Cuando haya mas productos,
// esto pasa a ser una tabla en la base como el resto de los modulos.
const CAMISETA_PRODUCT: CamisetaProduct = {
  id: "camiseta-clasica",
  name: "Camiseta Clasica",
  description: "Camiseta 100% algodon.",
  price: 1500,
  currency: "UYU",
  imageUrl: ""
};

// A donde vuelve el comprador despues de pagar (o cancelar) en Mercado
// Pago. El front usa HashRouter en produccion (Github Pages), por eso el
// "#/..." en cada ruta.
const DEFAULT_FRONTEND_URL = "https://monraspgit.github.io/frontend-camisetas/";

@Injectable()
export class CamisetasService {
  getProduct(): { item: CamisetaProduct } {
    return { item: CAMISETA_PRODUCT };
  }

  async createCheckoutPreference(): Promise<{ initPoint: string }> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new BadRequestException("MP_ACCESS_TOKEN no esta configurado en el servidor.");
    }

    const frontendUrl = (process.env.CAMISETAS_FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/$/, "");

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: CAMISETA_PRODUCT.id,
            title: CAMISETA_PRODUCT.name,
            description: CAMISETA_PRODUCT.description,
            picture_url: CAMISETA_PRODUCT.imageUrl || undefined,
            quantity: 1,
            currency_id: CAMISETA_PRODUCT.currency,
            unit_price: CAMISETA_PRODUCT.price
          }
        ],
        external_reference: CAMISETA_PRODUCT.id,
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
