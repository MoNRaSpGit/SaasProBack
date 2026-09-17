export type QqUserRole = "administrador" | "usuario";

export type QqUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: QqUserRole;
};

export type QqProductStatus = "published" | "draft";

export type QqProduct = {
  id: number;
  name: string;
  description: string | null;
  // Dos precios independientes (16/09/2026) -- "hay tarjetas que llevan
  // los dos, otras que no". Al menos uno de los dos siempre esta
  // cargado (se valida en el DTO/service), pero nunca los dos a la vez
  // son obligatorios.
  accountPrice: number | null;
  profilePrice: number | null;
  currency: string;
  imageUrl: string | null;
  // true si el admin subio una foto (se sirve por GET
  // /qq/products/:id/image) -- el frontend arma esa URL solo, no viene
  // armada desde aca.
  hasImage: boolean;
  category: string | null;
  status: QqProductStatus;
  // Numero de posicion en el catalogo (16/09/2026) -- "si la cambio al
  // puesto 1, la que estaba en el 1 pasa al puesto de la que cambie".
  // El publico ve las tarjetas ordenadas por esto, no por fecha.
  position: number;
  createdAt: string;
};

export type QqClient = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  dueDate: string;
  createdAt: string;
};
