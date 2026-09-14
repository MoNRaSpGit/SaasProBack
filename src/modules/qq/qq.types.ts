export type QqProductStatus = "published" | "draft";

export type QqProduct = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  category: string | null;
  status: QqProductStatus;
  createdAt: string;
};
