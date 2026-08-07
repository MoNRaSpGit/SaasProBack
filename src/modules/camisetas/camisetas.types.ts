export type CamisetaProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  currency: string;
  imageUrl: string;
};

export type CamisetaSaleMovement = {
  id: number;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  currency: string;
  mpPaymentId: string;
  mpStatus: string;
  createdAt: string;
};

// Snapshot de un carrito al momento de generar la preferencia de pago.
// Se guarda en saas_camisetas_pending_orders para que el webhook sepa
// exactamente que se compro, sin depender del desglose que devuelva MP.
export type CamisetaPendingOrderItem = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  currency: string;
};

export type CamisetaBestSeller = {
  productId: string;
  productName: string;
  unitsSold: number;
  totalVendido: number;
};

export type CamisetaPanelSummary = {
  totalVendido: number;
  totalGanancia: number;
  cantidadVentas: number;
  currency: string;
  movimientos: CamisetaSaleMovement[];
  masVendidas: CamisetaBestSeller[];
};
