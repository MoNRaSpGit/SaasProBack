import { BadRequestException } from "@nestjs/common";

// Antes de esta fecha, la deuda de cada cliente era un total acumulado sin
// desglose por boleta (el sistema original tenia su propio pago de
// clientes, nunca portado, que ajustaba la deuda directamente). Por eso las
// boletas de credito anteriores a este momento no se pueden pagar de forma
// individual -- ver esPagoIndividualHabilitado. Las boletas creadas desde
// este momento en adelante si tienen su propio saldo pendiente confiable y
// se pueden pagar una por una (pagarVentaCredito). El pago generico de
// deuda vieja (pagarDeudaCliente/"Pagar deuda") que existia para esas
// boletas viejas se saco a pedido del cliente: solo habia datos de prueba,
// sin deuda real que reconciliar.
const CREDIT_PAYMENT_FEATURE_LAUNCH_AT = new Date("2026-08-15T10:06:34.277Z");

// Compara como fechas reales (Date), no como strings -- una comparacion de
// strings solo da el resultado correcto si ambos lados vienen siempre en
// el mismo formato ISO exacto (mismos decimales, misma "Z"), lo cual es
// facil de romper sin que TypeScript avise. Con Date el resultado es
// correcto sea cual sea el formato de entrada.
export function esPagoIndividualHabilitado(fecha: string | Date, metodoPago: string): boolean {
  if (metodoPago !== "credito") {
    return false;
  }
  const fechaVenta = fecha instanceof Date ? fecha : new Date(fecha);
  return fechaVenta.getTime() >= CREDIT_PAYMENT_FEATURE_LAUNCH_AT.getTime();
}

// Matematica pura del pago (total o parcial) de una boleta de credito en
// una moneda -- separada de OriolSalesService.pagarVentaCredito para poder
// testearla sin tocar la base. Cada moneda de una boleta se paga de forma
// independiente (ver saldoPendientePesos/saldoPendienteDolares en
// OriolSale), asi que total/montoPagadoActual ya vienen de una sola moneda.
export function calcularPagoCredito(params: {
  total: number;
  montoPagadoActual: number;
  tipo: "completo" | "parcial";
  monto?: number;
}): { montoAPagar: number; saldoPendiente: number; saldoNuevo: number } {
  const saldoPendiente = params.total - params.montoPagadoActual;
  if (saldoPendiente <= 0) {
    throw new BadRequestException("Esta boleta ya esta saldada en esa moneda");
  }

  const montoAPagar = params.tipo === "completo" ? saldoPendiente : params.monto ?? 0;
  if (params.tipo === "parcial" && (!montoAPagar || montoAPagar <= 0 || montoAPagar > saldoPendiente)) {
    throw new BadRequestException("El monto del pago parcial no es valido");
  }

  const saldoNuevo = saldoPendiente - montoAPagar;
  return { montoAPagar, saldoPendiente, saldoNuevo };
}
