export type PeluqueriaReservation = {
  id: number;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  createdAt: string;
};

export type PeluqueriaBusySlot = {
  date: string;
  time: string;
};
