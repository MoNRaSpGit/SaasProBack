export type JokerProductType = "simple" | "extra";
export type JokerProductStatus = "draft" | "published";
export type JokerPricingUnit = "unidad" | "kg";

export type JokerProduct = {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  subcategoryDetail: string | null;
  brand: string | null;
  price: number;
  ingredients: string | null;
  observations: string | null;
  productType: JokerProductType;
  status: JokerProductStatus;
  pricingUnit: JokerPricingUnit;
  createdAt: string;
  updatedAt: string;
};

export type JokerOrderItem = {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  detail?: string;
};

export type JokerPaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "cuenta";

export type JokerOrder = {
  id: number;
  total: number;
  address: string;
  paymentMethod: JokerPaymentMethod;
  items: JokerOrderItem[];
  createdAt: string;
};
