export type EjemploPaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "cuenta";

export type EjemploProduct = {
  id: string;
  rubro: string;
  category: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string | null;
  createdAt: string;
};

export type EjemploClient = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

export type EjemploSale = {
  id: string;
  rubro: string;
  productId: string | null;
  productName: string;
  price: number;
  quantity: number;
  total: number;
  paymentMethod: EjemploPaymentMethod;
  clientId: string | null;
  createdAt: string;
};

export type EjemploAccountEntry = {
  id: string;
  clientId: string;
  saleId: string | null;
  total: number;
  isSettled: boolean;
  createdAt: string;
  settledAt: string | null;
};

export type EjemploPanelSummary = {
  rubro: string;
  totalVendido: number;
  ventasCount: number;
  paymentTotals: Record<EjemploPaymentMethod, number>;
  topProducts: Array<{ productName: string; quantity: number; total: number }>;
};
