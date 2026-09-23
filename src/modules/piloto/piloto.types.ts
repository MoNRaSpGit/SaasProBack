export type PilotoProductStatus = "active" | "inactive";

export type PilotoProduct = {
  id: number;
  name: string;
  barcode: string;
  price: number;
  stock: number;
  hasImage: boolean;
  status: PilotoProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type PilotoPaymentMethod = "efectivo" | "tarjeta" | "credito";

export type PilotoSale = {
  id: number;
  totalAmount: number;
  itemsCount: number;
  paymentMethod: PilotoPaymentMethod;
  createdAt: string;
};

// "Precios" -- Modo Pro (23/09/2026): lista organizada de precios por
// categoria, independiente de los productos reales del escaner
// (PilotoProduct/saas_piloto_products).
export type PilotoPriceCategory = "congelados" | "frutas_verduras" | "empanadas" | "otros";

export type PilotoPriceEntry = {
  id: number;
  category: PilotoPriceCategory;
  name: string;
  price: number;
  createdAt: string;
  updatedAt: string;
};

// "Panel de control" -- Modo Pro (24/09/2026, pedido explicito): ventas,
// ganancia (30% de las ventas) y el detalle de cada venta del dia
// ("Movimientos"). PROFIT_MARGIN_RATIO vive en un solo lugar para no
// repetir el 0.3 en mas de un archivo.
export const PILOTO_PROFIT_MARGIN_RATIO = 0.3;

export type PilotoSaleMovementItem = {
  name: string;
  quantity: number;
};

export type PilotoSaleMovement = {
  id: number;
  // Numero de venta DEL DIA (1, 2, 3...), no el id interno -- mas facil
  // de leer para el usuario que el id real de la base.
  displayNumber: number;
  createdAt: string;
  totalAmount: number;
  paymentMethod: PilotoPaymentMethod;
  items: PilotoSaleMovementItem[];
};

export type PilotoSalesSummary = {
  date: string;
  salesCount: number;
  totalAmount: number;
  profitAmount: number;
  profitMarginRatio: number;
  sales: PilotoSaleMovement[];
};
