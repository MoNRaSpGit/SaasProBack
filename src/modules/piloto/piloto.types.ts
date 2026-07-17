export type PilotoProductStatus = "active" | "inactive";

export type PilotoProduct = {
  id: number;
  name: string;
  barcode: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  status: PilotoProductStatus;
  createdAt: string;
  updatedAt: string;
};
