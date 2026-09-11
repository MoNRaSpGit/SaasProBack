export type DeliveryUserRole = "administrador" | "delivery";

export type DeliveryUser = {
  id: number;
  name: string;
  role: DeliveryUserRole;
};

export type DeliveryEventStatus = "abierto" | "cerrado" | "cancelado";

export type DeliveryEvent = {
  id: number;
  place: string;
  startsAt: string;
  notes: string | null;
  slots: number | null;
  status: DeliveryEventStatus;
  createdBy: number;
  createdAt: string;
  // Quienes se anotaron a este evento -- se arma con un join en
  // listEvents(), no es una tabla propia en el tipo.
  signups: DeliverySignup[];
};

export type DeliverySignup = {
  id: number;
  eventId: number;
  userId: number;
  userName: string;
  createdAt: string;
};
