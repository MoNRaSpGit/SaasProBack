// Horario semanal de una peluqueria (editable por el dueño mas adelante).
// days: clave = dia de la semana (0 = domingo ... 6 = sabado); un dia sin clave
// es dia cerrado; cada dia puede tener varios tramos (turno cortado).
export type PeluqueriaSchedule = {
  slotMinutes: number;
  days: Record<string, Array<[string, string]>>;
};

export type PeluqueriaBarber = { id: number; name: string };

export type PeluqueriaSalonPublic = {
  slug: string;
  name: string;
  logoUrl: string | null;
  barbers: PeluqueriaBarber[];
  schedule: PeluqueriaSchedule;
};

export type PeluqueriaReservation = {
  id: number;
  barberId: number | null;
  peluquero: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  clientVisits: number;
  createdAt: string;
};

export type PeluqueriaBusySlot = {
  date: string;
  time: string;
};

export type PeluqueriaOwner = {
  id: number;
  username: string;
  salonId: number;
  salonSlug: string;
  salonName: string;
};
