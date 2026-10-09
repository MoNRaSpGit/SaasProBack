export type DistribuidoraClient = {
  id: number;
  name: string;
  rut: string | null;
  address: string | null;
  phone: string | null;
};

export type DistribuidoraProduct = {
  id: number;
  // Codigo de la planilla original del cliente; null en los productos
  // dados de alta a mano desde la app.
  code: string | null;
  name: string;
  category: string | null;
  price: number;
  active: boolean;
};

export type DistribuidoraOrderItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

export const ORDER_STATUSES = ["pendiente", "facturado"] as const;
export type DistribuidoraOrderStatus = (typeof ORDER_STATUSES)[number];

export type DistribuidoraOrder = {
  id: number;
  clientId: number | null;
  clientName: string;
  clientRut: string | null;
  clientAddress: string | null;
  items: DistribuidoraOrderItem[];
  total: number;
  note: string | null;
  status: DistribuidoraOrderStatus;
  invoiceNumber: number | null;
  invoicedAt: string | null;
  createdAt: string;
};
