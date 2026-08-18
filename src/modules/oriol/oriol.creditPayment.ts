import { BadRequestException } from "@nestjs/common";

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
