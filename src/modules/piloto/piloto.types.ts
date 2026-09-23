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
