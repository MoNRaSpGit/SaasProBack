import { JokerAccountPaymentCoveredEntry } from "./joker.types";

export type JokerAccountOpenEntryForAllocation = {
  id: number;
  orderId: number | null;
  total: number;
};

// Recorre las boletas abiertas de mas vieja a mas nueva (asumiendo que
// openEntries ya viene ordenado asi). Primero "salta" lo que los pagos
// anteriores ya cubrieron (alreadyPaid), y recien despues aplica el monto
// del pago nuevo sobre lo que quede -- asi un pago siempre cubre boletas
// viejas antes que nuevas, sin importar si hubo compras nuevas entre medio
// de pagos anteriores. Es una funcion pura (sin acceso a la base) para
// poder testearla sola: es la parte mas delicada de todo el pago parcial.
export function allocatePaymentFifo(
  openEntries: JokerAccountOpenEntryForAllocation[],
  alreadyPaid: number,
  newAmount: number
): JokerAccountPaymentCoveredEntry[] {
  let remainingToSkip = alreadyPaid;
  let remainingNew = newAmount;
  const covered: JokerAccountPaymentCoveredEntry[] = [];

  for (const entry of openEntries) {
    let entryRemaining = entry.total;

    if (remainingToSkip > 0) {
      const consumed = Math.min(remainingToSkip, entryRemaining);
      entryRemaining -= consumed;
      remainingToSkip -= consumed;
    }

    if (entryRemaining <= 0) continue;
    if (remainingNew <= 0) break;

    const applied = Math.round(Math.min(remainingNew, entryRemaining) * 100) / 100;
    covered.push({ entryId: entry.id, orderId: entry.orderId, entryTotal: entry.total, amountApplied: applied });
    remainingNew = Math.round((remainingNew - applied) * 100) / 100;
  }

  return covered;
}
