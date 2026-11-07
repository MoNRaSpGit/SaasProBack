export type GabyProductStatus = "active" | "inactive";

export type GabyProduct = {
  id: number;
  name: string;
  barcode: string;
  price: number;
  stock: number;
  hasImage: boolean;
  status: GabyProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type GabyPaymentMethod = "efectivo" | "tarjeta" | "credito";

export type GabySale = {
  id: number;
  totalAmount: number;
  itemsCount: number;
  paymentMethod: GabyPaymentMethod;
  createdAt: string;
};

// "Precios" -- Modo Pro (23/09/2026): lista organizada de precios por
// categoria, independiente de los productos reales del escaner
// (GabyProduct/saas_gaby_products).
export type GabyPriceCategory = "congelados" | "frutas_verduras" | "empanadas" | "otros";

export type GabyPriceEntry = {
  id: number;
  category: GabyPriceCategory;
  name: string;
  price: number;
  createdAt: string;
  updatedAt: string;
};

// "Panel de control" -- Modo Pro (24/09/2026, pedido explicito): ventas,
// ganancia (30% de las ventas) y el detalle de cada venta del dia
// ("Movimientos"). PROFIT_MARGIN_RATIO vive en un solo lugar para no
// repetir el 0.3 en mas de un archivo.
export const GABY_PROFIT_MARGIN_RATIO = 0.3;

export type GabySaleMovementItem = {
  name: string;
  quantity: number;
  // Pedido explicito (24/09/2026): "hacerle click a la venta que muestre
  // en detalle los productos, uno arriba del otro, con el precio".
  unitPrice: number;
  lineTotal: number;
};

export type GabySaleMovement = {
  id: number;
  // Numero de venta DEL DIA (1, 2, 3...), no el id interno -- mas facil
  // de leer para el usuario que el id real de la base.
  displayNumber: number;
  createdAt: string;
  totalAmount: number;
  paymentMethod: GabyPaymentMethod;
  items: GabySaleMovementItem[];
};

export type GabySalesSummary = {
  date: string;
  salesCount: number;
  totalAmount: number;
  profitAmount: number;
  profitMarginRatio: number;
  sales: GabySaleMovement[];
};

// Clientes / cuenta corriente (06/10/2026, pedido explicito: "venta a
// credito... que le salgan esos 5 clientes... armar toda la parte del
// cliente, similar a la de Joker, pero plan basico" -- version simple:
// sin pagos parciales ni archivo historico, solo boletas + "saldar
// cuenta" que las borra todas de una).
export type GabyClient = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
};

export type GabyAccountEntryItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type GabyAccountEntry = {
  id: number;
  clientId: number;
  saleId: number | null;
  total: number;
  items: GabyAccountEntryItem[];
  createdAt: string;
};
