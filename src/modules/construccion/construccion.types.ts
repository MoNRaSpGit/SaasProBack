export const CARGOS = ["Capataz", "Oficial", "Medio oficial", "Peon", "Ayudante"] as const;
export type Cargo = (typeof CARGOS)[number];

export const ASISTENCIA_ESTADOS = ["presente", "media", "ausente"] as const;
export type AsistenciaEstado = (typeof ASISTENCIA_ESTADOS)[number];

export type ConstruccionObra = {
  id: number;
  nombre: string;
  direccion: string;
  activa: boolean;
  createdAt: string;
};

export type ConstruccionPersonal = {
  id: number;
  nombre: string;
  cargo: string;
  telefono: string;
  obraId: number | null;
  jornal: number;
  fechaIngreso: string;
  activo: boolean;
  createdAt: string;
};

export type ConstruccionAsistencia = {
  id: number;
  personalId: number;
  fecha: string;
  estado: AsistenciaEstado;
};

export type ConstruccionAnticipo = {
  id: number;
  personalId: number;
  fecha: string;
  monto: number;
  nota: string;
  createdAt: string;
};

export type ConstruccionLiquidacionItem = {
  personalId: number;
  nombre: string;
  cargo: string;
  obraId: number | null;
  jornal: number;
  diasPresentes: number;
  diasMedios: number;
  diasAusentes: number;
  totalJornales: number;
  totalAnticipos: number;
  totalAPagar: number;
};
