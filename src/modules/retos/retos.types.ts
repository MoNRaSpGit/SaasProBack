export type RetoType = "unico" | "diario" | "semanal";
export type RetoResult = "cumplido" | "fallado";

export type RetoRank = { key: string; label: string; emoji: string };

// Escala de niveles (20/10/2026, pedido explicito): de mas bajo a mas
// alto. Un reto cumplido sube un escalon, uno fallado baja uno -- nunca
// sale de estos limites (indice 0 a RANKS.length - 1).
export const RANKS: RetoRank[] = [
  { key: "huevito", label: "Huevito", emoji: "🥚" },
  { key: "gatito", label: "Gatito", emoji: "🐱" },
  { key: "soldadito", label: "Soldadito", emoji: "🪖" },
  { key: "espadita", label: "Espadita", emoji: "⚔️" },
  { key: "fueguito", label: "Fueguito", emoji: "🔥" },
  { key: "estrella", label: "Estrella", emoji: "⭐" },
  { key: "cohete", label: "Cohete", emoji: "🚀" },
  { key: "rayo", label: "Rayo", emoji: "⚡" },
  { key: "corona", label: "Corona", emoji: "👑" }
];

export type RetoChallenge = {
  id: number;
  title: string;
  type: RetoType;
  active: boolean;
  createdAt: string;
  resolvedForCurrentPeriod: boolean;
};

export type RetoCompletion = {
  id: number;
  challengeId: number;
  challengeTitle: string;
  challengeType: RetoType;
  periodLabel: string | null;
  result: RetoResult;
  rankAfter: number;
  resolvedAt: string;
};

export type RetoState = {
  rankIndex: number;
  rank: RetoRank;
  totalCumplidos: number;
  totalFallados: number;
};
