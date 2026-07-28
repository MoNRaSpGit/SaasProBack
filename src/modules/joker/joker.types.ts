export type JokerProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
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

export type JokerPaymentMethod = "efectivo" | "tarjeta" | "cuenta";

export type JokerOrder = {
  id: number;
  total: number;
  address: string;
  paymentMethod: JokerPaymentMethod;
  items: JokerOrderItem[];
  createdAt: string;
};
