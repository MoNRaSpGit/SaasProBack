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
  displayNumber: number;
  total: number;
  address: string;
  paymentMethod: JokerPaymentMethod;
  customerName: string | null;
  items: JokerOrderItem[];
  createdAt: string;
};

export type JokerClient = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
};

export type JokerAccountEntryItem = {
  productName: string;
  quantity: number;
};

export type JokerAccountEntry = {
  id: number;
  clientId: number;
  total: number;
  items: JokerAccountEntryItem[];
  createdAt: string;
};

// Copia permanente de un consumo de cuenta corriente al momento en que se
// paga o el cliente se elimina (ver joker.service.ts#archiveClientEntries).
export type JokerAccountSettlement = {
  id: number;
  clientId: number;
  clientName: string;
  entryId: number;
  total: number;
  items: JokerAccountEntryItem[];
  entryCreatedAt: string;
  reason: "pago" | "cliente_eliminado";
  settledAt: string;
};

export type JokerStockItem = {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type JokerProductRecipeLine = {
  stockItemId: number;
  stockItemName: string;
  unit: string;
  quantityPerUnit: number;
};

export type JokerRegisterState = {
  isOpen: boolean;
  lastClosedAt: string | null;
};

export type JokerRegisterPaymentTotals = Record<JokerPaymentMethod, number>;

export type JokerRegisterCloseRankingItem = {
  productName: string;
  quantity: number;
};

export type JokerRegisterClose = {
  id: number;
  closedAt: string;
  totalVendido: number;
  ganancia: number;
  paymentTotals: JokerRegisterPaymentTotals;
  ranking: JokerRegisterCloseRankingItem[];
};
