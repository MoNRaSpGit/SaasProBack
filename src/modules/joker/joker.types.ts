export type JokerProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
  createdAt: string;
  updatedAt: string;
};

export type JokerOrderItem = {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  detail?: string;
};

export type JokerOrder = {
  id: number;
  total: number;
  address: string;
  items: JokerOrderItem[];
  createdAt: string;
};
