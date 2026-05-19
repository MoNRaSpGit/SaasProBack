import { ModuleRequestUser } from "../../shared/authz/module-auth";

export type AlamcenRequestUser = ModuleRequestUser;

export type AlamcenStatusResponse = {
  module: "alamcen";
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  user: {
    id: number;
    email: string;
    membershipRole: string;
  };
  backend: {
    database: "connected";
    currentTimestamp: string;
  };
  phase: "sprint-1";
  capabilities: string[];
};

export type AlamcenProductLookupResponse = {
  id: number;
  legacyProductoId: number | null;
  nombre: string;
  descripcion: string | null;
  barcode: string | null;
  barcodeNormalized: string | null;
  precioVenta: number;
  precioLista: number | null;
  stockActual: number;
  categoria: string | null;
  categoriaCompact: string | null;
  categoriaId: number | null;
  supplierId: number | null;
  subcategoria: string | null;
  tieneImagen: boolean;
  estado: "activo" | "inactivo" | "sin_stock" | "archivado";
  imagen: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AlamcenMovement = {
  id: string;
  type: "Venta" | "Pago";
  amount: number;
  createdAt: string;
  detail: {
    kind: "sale" | "payment";
    description?: string | null;
    operator?: string;
    createdAt?: string;
    items?: Array<{
      id: number;
      name: string;
      quantity: number;
      lineTotal: number;
    }>;
  };
};

export type AlamcenDashboardResponse = {
  date: string;
  metrics: {
    initialCash: number;
    salesToday: number;
    currentAmount: number;
    paymentsTotal: number;
  };
  comparison: {
    today: number;
    yesterday: number;
    record: number;
  };
  movements: AlamcenMovement[];
  ranking: Array<{
    key: string;
    name: string;
    qty: number;
    thumbnailUrl: string | null;
  }>;
};
