export type OriolCurrency = "UYU" | "USD";

export type OriolProduct = {
  id: number;
  name: string;
  price: number;
  description: string | null;
  currency: OriolCurrency;
  codigoBarra: string | null;
  stock: number;
  stockMinimo: number | null;
};

// Item guardado dentro del JSON "detalle" de cada venta -- congela el
// nombre/precio/moneda del producto en el momento de la venta, para que
// reimprimir un ticket viejo no cambie si el producto se edita despues.
export type OriolSaleItem = {
  id: number;
  name: string;
  cantidad: number;
  precio: number;
  currency: OriolCurrency;
};

export type OriolPaymentMethod = "efectivo" | "tarjeta" | "credito";

export type OriolSale = {
  id: number;
  clienteId: number | null;
  fecha: string;
  totalPesos: number;
  totalDolares: number;
  detalle: OriolSaleItem[];
  metodoPago: OriolPaymentMethod;
};

export type OriolClient = {
  id: number;
  nombre: string;
  telefono: string | null;
  cedula: string | null;
  deuda: number;
  createdAt: string;
};

export type OriolPayment = {
  id: number;
  valor: number;
  detalle: string;
  fecha: string;
};

export type OriolConfig = {
  cambio: number;
};

export type OriolPanelMovimiento = {
  ventaId: number;
  fecha: string;
  metodoPago: OriolPaymentMethod;
  totalPesos: number;
  totalDolares: number;
  clienteId: number | null;
};

// Todo se calcula en vivo a partir de saas_oriol_ventas/saas_oriol_pagos en
// cada request -- no hay tabla de "cierre" ni totales guardados que se
// puedan desincronizar de las ventas reales.
export type OriolPanelHoy = {
  cambio: number;
  ventasDelDiaPesos: number;
  gananciaPesos: number;
  totalesPorMetodo: Record<OriolPaymentMethod, { pesos: number; dolares: number }>;
  pagosDelDiaPesos: number;
  cajaActualPesos: number;
  movimientos: OriolPanelMovimiento[];
};

export type OriolMonthWeek = {
  semana: number;
  totalPesos: number;
  dias: Array<{ fecha: string; totalPesos: number }>;
};

export type OriolMonthSummary = {
  anio: number;
  mes: number;
  totalPesos: number;
  semanas: OriolMonthWeek[];
};

export type OriolMonthHistoryItem = {
  anio: number;
  mes: number;
  totalPesos: number;
};
