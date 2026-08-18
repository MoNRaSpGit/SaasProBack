import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { calcularPagoCredito, esPagoIndividualHabilitado } from "./oriol.creditPayment";

describe("calcularPagoCredito", () => {
  it("pago completo salda todo el saldo pendiente", () => {
    const resultado = calcularPagoCredito({ total: 490, montoPagadoActual: 0, tipo: "completo" });
    expect(resultado).toEqual({ montoAPagar: 490, saldoPendiente: 490, saldoNuevo: 0 });
  });

  it("pago completo sobre un saldo que ya tiene un pago parcial previo", () => {
    const resultado = calcularPagoCredito({ total: 490, montoPagadoActual: 200, tipo: "completo" });
    expect(resultado).toEqual({ montoAPagar: 290, saldoPendiente: 290, saldoNuevo: 0 });
  });

  it("pago parcial deja el resto pendiente", () => {
    const resultado = calcularPagoCredito({ total: 490, montoPagadoActual: 0, tipo: "parcial", monto: 100 });
    expect(resultado).toEqual({ montoAPagar: 100, saldoPendiente: 490, saldoNuevo: 390 });
  });

  it("rechaza un pago parcial mayor al saldo pendiente", () => {
    expect(() => calcularPagoCredito({ total: 490, montoPagadoActual: 0, tipo: "parcial", monto: 500 })).toThrow(
      BadRequestException
    );
  });

  it("rechaza un pago parcial en 0 o negativo", () => {
    expect(() => calcularPagoCredito({ total: 490, montoPagadoActual: 0, tipo: "parcial", monto: 0 })).toThrow(
      BadRequestException
    );
    expect(() => calcularPagoCredito({ total: 490, montoPagadoActual: 0, tipo: "parcial", monto: -10 })).toThrow(
      BadRequestException
    );
  });

  it("rechaza un pago parcial sin monto", () => {
    expect(() => calcularPagoCredito({ total: 490, montoPagadoActual: 0, tipo: "parcial" })).toThrow(BadRequestException);
  });

  it("rechaza pagar una boleta que ya esta saldada en esa moneda", () => {
    expect(() => calcularPagoCredito({ total: 490, montoPagadoActual: 490, tipo: "completo" })).toThrow(BadRequestException);
    expect(() => calcularPagoCredito({ total: 490, montoPagadoActual: 490, tipo: "parcial", monto: 10 })).toThrow(
      BadRequestException
    );
  });

  it("una boleta con items mezclados paga cada moneda de forma totalmente independiente", () => {
    // Boleta con $490 y U$49.50 pendientes -- pagar completo el lado pesos
    // no debe tocar para nada el resultado del lado dolares.
    const pagoPesos = calcularPagoCredito({ total: 490, montoPagadoActual: 0, tipo: "completo" });
    const pagoDolares = calcularPagoCredito({ total: 49.5, montoPagadoActual: 20, tipo: "parcial", monto: 15 });

    expect(pagoPesos.saldoNuevo).toBe(0);
    expect(pagoDolares.saldoNuevo).toBeCloseTo(14.5, 2);
  });
});

describe("esPagoIndividualHabilitado", () => {
  it("una boleta a credito creada despues del lanzamiento de la funcion se puede pagar individualmente", () => {
    expect(esPagoIndividualHabilitado("2026-08-15T10:06:34.278Z", "credito")).toBe(true);
    expect(esPagoIndividualHabilitado("2026-09-01T00:00:00.000Z", "credito")).toBe(true);
  });

  it("una boleta a credito creada justo en el instante del lanzamiento cuenta como habilitada", () => {
    expect(esPagoIndividualHabilitado("2026-08-15T10:06:34.277Z", "credito")).toBe(true);
  });

  it("una boleta a credito creada antes del lanzamiento NO se puede pagar individualmente", () => {
    expect(esPagoIndividualHabilitado("2026-08-15T10:06:34.276Z", "credito")).toBe(false);
    expect(esPagoIndividualHabilitado("2026-01-01T00:00:00.000Z", "credito")).toBe(false);
  });

  it("una venta que no es a credito nunca esta habilitada, sin importar la fecha", () => {
    expect(esPagoIndividualHabilitado("2026-09-01T00:00:00.000Z", "efectivo")).toBe(false);
    expect(esPagoIndividualHabilitado("2026-09-01T00:00:00.000Z", "tarjeta")).toBe(false);
  });

  it("funciona igual pasando un Date que un string, y no depende del formato exacto del string", () => {
    // Mismo instante escrito con distinta cantidad de decimales -- una
    // comparacion de strings ingenua podria fallar aca, Date no.
    expect(esPagoIndividualHabilitado(new Date("2026-09-01T00:00:00.000Z"), "credito")).toBe(true);
    expect(esPagoIndividualHabilitado("2026-09-01T00:00:00Z", "credito")).toBe(true);
  });
});
