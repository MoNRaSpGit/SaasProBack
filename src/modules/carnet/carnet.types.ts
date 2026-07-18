export type CarnetSex = "masculino" | "femenino";

export type CarnetPlayer = {
  id: number;
  name: string;
  expiryDate: string;
  sex: CarnetSex;
  cedula: string | null;
  birthDate: string | null;
  sales: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CarnetEvent = {
  id: number;
  name: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  playersCount: number;
  totalSales: number;
};

export type CarnetEventSaleBuyer = {
  id: number;
  buyerName: string;
  quantity: number;
  delivered: boolean;
};

export type CarnetEventRankingItem = {
  id: number;
  playerId: number;
  playerName: string;
  sales: number;
  position: number;
  buyers: CarnetEventSaleBuyer[];
  unassignedSales: number;
};

export type CarnetEventDetail = {
  event: CarnetEvent;
  players: CarnetPlayer[];
  ranking: CarnetEventRankingItem[];
};

export type CarnetStatus = {
  module: "carnet";
  status: "ok";
  playersCount: number;
  eventsCount: number;
  backend: {
    database: "connected";
    currentTimestamp: string;
  };
};
