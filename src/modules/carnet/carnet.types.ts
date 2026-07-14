export type CarnetPlayer = {
  id: number;
  name: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
};

export type CarnetStatus = {
  module: "carnet";
  status: "ok";
  playersCount: number;
  backend: {
    database: "connected";
    currentTimestamp: string;
  };
};
