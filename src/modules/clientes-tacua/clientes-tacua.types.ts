// Categorias de distribuidora (21/10/2026, pedido explicito): "los que
// estan correctos" vs a los que les falta algo. No son excluyentes entre
// si en la base (un cliente puede no tener direccion NI telefono), pero
// para elegir una sola categoria por fila se prioriza: sin direccion >
// sin telefono > completo.
export type DistribuidoraCategoria = "todos" | "completo" | "sin-direccion" | "sin-telefono";

// Categorias de GPS: geo_quality ya viene con esta escala de precision
// de cuando se geocodificaron (puerta = exacta, esquina/calle = aproximada).
export type GpsCategoria = "todos" | "puerta" | "esquina" | "calle";

export type DistribuidoraClienteTacua = {
  id: number;
  code: string | null;
  name: string;
  contactName: string | null;
  rut: string | null;
  address: string | null;
  phone: string | null;
  sellerCode: string | null;
  route: string | null;
  categoria: Exclude<DistribuidoraCategoria, "todos">;
};

export type GpsClienteTacua = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  assignedUsername: string | null;
  geoQuality: string | null;
};

export type ClientesTacuaResumen = {
  distribuidora: {
    total: number;
    completo: number;
    sinDireccion: number;
    sinTelefono: number;
  };
  gps: {
    total: number;
    puerta: number;
    esquina: number;
    calle: number;
  };
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
