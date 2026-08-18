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

// Pago (total o parcial) aplicado a una boleta de credito puntual.
// saldoAnterior/saldoNuevo quedan congelados en el momento del pago, para
// poder reconstruir el historial ("Juan debia 800 y pago 500 el...") aunque
// la boleta ya este saldada.
export type OriolCreditPaymentType = "completo" | "parcial";

// ventaId es null en pagos historicos contra la deuda vieja del cliente,
// de cuando existia un pago general no atado a ninguna boleta puntual (esa
// funcion ya no existe, pero esos registros viejos quedan como estan).
// moneda indica a cual de los dos saldos del cliente (deuda o
// deudaDolares) afecto este pago -- ver OriolClient.
export type OriolCreditPayment = {
  id: number;
  ventaId: number | null;
  clienteId: number;
  monto: number;
  moneda: OriolCurrency;
  tipo: OriolCreditPaymentType;
  saldoAnterior: number;
  saldoNuevo: number;
  fecha: string;
};

export type OriolSale = {
  id: number;
  clienteId: number | null;
  fecha: string;
  totalPesos: number;
  totalDolares: number;
  // Solo relevantes para metodoPago "credito" -- 0 en efectivo/tarjeta. Los
  // dos saldos son independientes, sin conversion entre ellos (ver
  // OriolClient.deuda / deudaDolares).
  montoPagadoPesos: number;
  montoPagadoDolares: number;
  saldoPendientePesos: number;
  saldoPendienteDolares: number;
  // Solo las boletas de credito creadas desde que existe el pago por
  // boleta puntual pueden pagarse individualmente (ver
  // esPagoIndividualHabilitado en oriol.creditPayment.ts) -- las anteriores ya
  // tenian deuda acumulada sin desglose por boleta.
  pagoIndividualHabilitado: boolean;
  detalle: OriolSaleItem[];
  metodoPago: OriolPaymentMethod;
  pagos: OriolCreditPayment[];
};

// Dos saldos reales e independientes, sin conversion entre ellos. La deuda
// acumulada antes de este cambio (mezclada, convertida a pesos con
// TASA_DOLAR) quedo toda en `deuda` -- no se reconstruyo retroactivamente
// que parte "era" dolares. Desde este cambio en adelante cada venta a
// credito suma a `deuda` o `deudaDolares` segun la moneda real del item.
export type OriolClient = {
  id: number;
  nombre: string;
  telefono: string | null;
  cedula: string | null;
  deuda: number;
  deudaDolares: number;
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
  tasaDolar: number;
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
// corregir a mano despues (ver OriolPanelService.editarCierreDia) -- una vez
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
