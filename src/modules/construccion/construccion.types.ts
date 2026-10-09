export const CARGOS = ["Capataz", "Oficial", "Medio oficial", "Peon", "Ayudante"] as const;
export type Cargo = (typeof CARGOS)[number];

export const ASISTENCIA_ESTADOS = ["presente", "media", "ausente"] as const;
export type AsistenciaEstado = (typeof ASISTENCIA_ESTADOS)[number];

// Lista fija por ahora (06/10/2026, pedido explicito: "vamos a ir tildando
// lo que si y lo que no tiene"). Si el dia de mañana el cliente pide otros
// items, se agregan aca -- el mismo listado se usa en el frontend.
export const SEGURIDAD_ITEMS = ["casco", "chaleco", "botines", "guantes", "lentes", "arnes"] as const;
export type SeguridadItem = (typeof SEGURIDAD_ITEMS)[number];

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

export type ConstruccionSeguridad = {
  id: number;
  personalId: number;
  fecha: string;
  cumple: boolean;
  itemsFaltantes: SeguridadItem[];
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

// Registro interno de uso (09/10/2026): "entrada" = abrio la app,
// "seccion" = entro a una pestana, "accion" = guardo algo.
export const ACTIVITY_EVENTS = ["entrada", "seccion", "accion"] as const;
export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];
