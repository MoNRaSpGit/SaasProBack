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
  price: number;
  currency: string;
  imageUrl: string | null;
  // true si el admin subio una foto (se sirve por GET
  // /qq/products/:id/image) -- el frontend arma esa URL solo, no viene
  // armada desde aca.
  hasImage: boolean;
  category: string | null;
  status: QqProductStatus;
  createdAt: string;
};
