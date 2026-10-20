export type TallerLaborCategory = "chapa" | "pintura" | "otro";

export type TallerLaborItem = {
  category: TallerLaborCategory;
  description: string;
  price: number;
};

export type TallerQuotePart = {
  stockId: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type TallerStockItem = {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
};

export type TallerQuote = {
  id: number;
  vehicleInfo: string;
  clientName: string | null;
  laborItems: TallerLaborItem[];
  parts: TallerQuotePart[];
  total: number;
  createdAt: string;
};
