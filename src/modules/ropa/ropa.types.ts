export type RopaUserRole = "administrador" | "usuario";

export type RopaUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: RopaUserRole;
};

export type RopaProductStatus = "published" | "draft";

export type RopaProduct = {
  id: number;
  name: string;
  description: string | null;
  // Dos precios independientes (16/09/2026) -- "hay tarjetas que llevan
  // los dos, otras que no". Al menos uno de los dos siempre esta
  // cargado (se valida en el DTO/service), pero nunca los dos a la vez
  // son obligatorios.
  price: number;
  sizes: string[];
  currency: string;
  imageUrl: string | null;
  // true si el admin subio una foto (se sirve por GET
  // /ropa/products/:id/image) -- el frontend arma esa URL solo, no viene
  // armada desde aca.
  hasImage: boolean;
  category: string | null;
  status: RopaProductStatus;
  // Numero de posicion en el catalogo (16/09/2026) -- "si la cambio al
  // puesto 1, la que estaba en el 1 pasa al puesto de la que cambie".
  // El publico ve las tarjetas ordenadas por esto, no por fecha.
  position: number;
  createdAt: string;
};

export type RopaClient = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  dueDate: string;
  createdAt: string;
};

// Codigo de descuento (28/09/2026, pedido explicito): un solo codigo
// activo a la vez, configurable por el admin. Si "enabled" es false, el
// carrito no muestra el input de codigo -- ver CartDrawer.tsx.
export type RopaDiscountConfig = {
  code: string;
  percentage: number;
  enabled: boolean;
};
