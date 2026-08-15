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

// Un renglon por item vendido (no por venta -- cada producto de un
// carrito es su propio movimiento) o por pago a proveedor, mezclados y
// ordenados por fecha descendente. Igual que armarMovimientos() del
// backend original.
export type OriolPanelMovimiento = {
  tipo: "venta" | "pago";
  descripcion: string;
  cantidad: number | null;
  monto: number;
  currency: OriolCurrency | null;
  fecha: string;
};

// Todo se calcula en vivo a partir de saas_oriol_ventas/saas_oriol_pagos en
// cada request -- no hay tabla de "cierre" ni totales guardados que se
// puedan desincronizar de las ventas reales.
export type OriolPanelHoy = {
  totalTarjeta: { pesos: number; dolares: number };
  totalEfectivo: { pesos: number; dolares: number };
  totalCredito: { pesos: number; dolares: number };
  totalPagos: number;
  cambio: number;
  caja: number;
  ventasDelDia: number;
  ganancias: number;
  movimientos: OriolPanelMovimiento[];
};

export type OriolMonthDay = {
  fecha: string;
  diaSemana: string;
  totalPesos: number;
  totalDolares: number;
  // true si ya paso por el cierre automatico de las 00:00 (o se corrigio
  // a mano) -- ese valor es la fuente de verdad y no se recalcula mas.
  // false = todavia se esta calculando en vivo (el dia de hoy).
  cerrado: boolean;
};

// Cierre diario de caja: valor congelado (no en vivo) por dia, usado por
// Mes/graficas. Se genera solo con el cron de medianoche, pero se puede
// corregir a mano despues (ver OriolService.editarCierreDia) -- una vez
// editado a mano, el cron ya no lo vuelve a pisar.
export type OriolCierreDia = {
  fecha: string;
  totalPesos: number;
  totalDolares: number;
  editadoManualmente: boolean;
};

export type OriolMonthWeek = {
  numero: number;
  dias: OriolMonthDay[];
  totalPesos: number;
  totalDolares: number;
};

export type OriolMonthSummary = {
  anio: number;
  mes: number;
  totalPesos: number;
  totalDolares: number;
  semanas: OriolMonthWeek[];
};

export type OriolMonthHistoryItem = {
  anio: number;
  mes: number;
  totalPesos: number;
  totalDolares: number;
};
