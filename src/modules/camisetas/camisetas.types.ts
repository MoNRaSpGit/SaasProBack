export type CamisetaProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
};

export type CamisetaSaleMovement = {
  id: number;
  productId: string;
  productName: string;
  unitPrice: number;
  currency: string;
  mpPaymentId: string;
  mpStatus: string;
  createdAt: string;
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
