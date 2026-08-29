import { describe, expect, it } from "vitest";
import { allocatePaymentFifo } from "./joker-account-payment.logic";

describe("allocatePaymentFifo", () => {
  it("un pago cubre la boleta mas vieja primero, completa", () => {
    const entries = [
      { id: 1, orderId: 10, total: 700 },
      { id: 2, orderId: 11, total: 800 }
    ];
    const covered = allocatePaymentFifo(entries, 0, 700);
    expect(covered).toEqual([{ entryId: 1, orderId: 10, entryTotal: 700, amountApplied: 700 }]);
  });

  it("un pago que no alcanza para la primera boleta la cubre parcial", () => {
    const entries = [
      { id: 1, orderId: 10, total: 1000 },
      { id: 2, orderId: 11, total: 500 }
    ];
    const covered = allocatePaymentFifo(entries, 0, 300);
    expect(covered).toEqual([{ entryId: 1, orderId: 10, entryTotal: 1000, amountApplied: 300 }]);
  });

  it("un pago que sobrepasa la primera boleta sigue con la siguiente", () => {
    const entries = [
      { id: 1, orderId: 10, total: 700 },
      { id: 2, orderId: 11, total: 800 }
    ];
    const covered = allocatePaymentFifo(entries, 0, 1000);
    expect(covered).toEqual([
      { entryId: 1, orderId: 10, entryTotal: 700, amountApplied: 700 },
      { entryId: 2, orderId: 11, entryTotal: 800, amountApplied: 300 }
    ]);
  });

  it("alreadyPaid salta lo que un pago anterior ya cubrio antes de aplicar el nuevo", () => {
    const entries = [
      { id: 1, orderId: 10, total: 700 },
      { id: 2, orderId: 11, total: 800 }
    ];
    // Un pago anterior de 700 ya cubrio la boleta 1 entera. Este pago
    // nuevo de 300 tiene que caer todo en la boleta 2.
    const covered = allocatePaymentFifo(entries, 700, 300);
    expect(covered).toEqual([{ entryId: 2, orderId: 11, entryTotal: 800, amountApplied: 300 }]);
  });

  // Reproduce el escenario exacto que planteo el cliente: debe 1500, paga
  // 300 (queda 1200), paga 200 (queda 1000), compra 500 mas (queda 1500),
  // paga 1000 (queda 500), paga todo el resto.
  it("secuencia completa compra/pago/compra/pago sin desincronizarse", () => {
    const boletaInicial = { id: 1, orderId: 100, total: 1500 };

    // Pago 1: $300, sin pagos previos.
    let covered = allocatePaymentFifo([boletaInicial], 0, 300);
    expect(covered).toEqual([{ entryId: 1, orderId: 100, entryTotal: 1500, amountApplied: 300 }]);

    // Pago 2: $200, ya se pago $300 antes.
    covered = allocatePaymentFifo([boletaInicial], 300, 200);
    expect(covered).toEqual([{ entryId: 1, orderId: 100, entryTotal: 1500, amountApplied: 200 }]);
    // Saldo hasta aca: 1500 - 300 - 200 = 1000.

    // Compra nueva de $500: se agrega una boleta mas vieja-nueva al final.
    const boletaNueva = { id: 2, orderId: 101, total: 500 };
    const entries = [boletaInicial, boletaNueva];
    // Saldo ahora: 1000 + 500 = 1500.

    // Pago 3: $1000, ya se pago $500 en total antes (300+200).
    covered = allocatePaymentFifo(entries, 500, 1000);
    expect(covered).toEqual([
      // Termina de cubrir lo que quedaba de la boleta 1 (1500-500=1000 pendiente).
      { entryId: 1, orderId: 100, entryTotal: 1500, amountApplied: 1000 }
    ]);
    // Saldo hasta aca: 1500 - 500 - 1000 = 0 de la boleta 1, boleta 2 entera pendiente ($500).

    // Pago final: $500 (el resto), ya se pago $1500 en total antes.
    covered = allocatePaymentFifo(entries, 1500, 500);
    expect(covered).toEqual([{ entryId: 2, orderId: 101, entryTotal: 500, amountApplied: 500 }]);
    // Saldo final: 0 -- coincide con lo que se esperaria a mano.
  });

  it("sin boletas abiertas no cubre nada", () => {
    expect(allocatePaymentFifo([], 0, 100)).toEqual([]);
  });

  it("redondea a centavos para evitar arrastre de coma flotante", () => {
    const entries = [
      { id: 1, orderId: 10, total: 0.1 },
      { id: 2, orderId: 11, total: 0.2 }
    ];
    const covered = allocatePaymentFifo(entries, 0, 0.3);
    expect(covered).toEqual([
      { entryId: 1, orderId: 10, entryTotal: 0.1, amountApplied: 0.1 },
      { entryId: 2, orderId: 11, entryTotal: 0.2, amountApplied: 0.2 }
    ]);
  });
});
