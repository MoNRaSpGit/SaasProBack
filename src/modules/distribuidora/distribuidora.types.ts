export type DistribuidoraClient = {
  id: number;
  // Codigo de la planilla original; null en los dados de alta desde la app.
  code: string | null;
  name: string;
  // La persona, cuando el negocio tiene otro nombre ("Almacen" / "Ana Silva").
  contactName: string | null;
  rut: string | null;
  address: string | null;
  phone: string | null;
};

export type DistribuidoraProduct = {
  id: number;
  // Codigo de la planilla original del cliente; null en los productos
  // dados de alta a mano desde la app.
  code: string | null;
  name: string;
  category: string | null;
  price: number;
  active: boolean;
};

export type DistribuidoraOrderItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

// Auditoria interna (09/10/2026): que se hizo, cuando y desde que
// dispositivo. No hay login, asi que "quien" es el id que genera el
// navegador (deviceId) mas el user agent.
export const AUDIT_ACTIONS = [
  "order_create",
  "order_update",
  "order_delete",
  "order_invoice",
  "product_create",
  "product_update",
  "product_delete",
  "client_create",
  "client_update"
] as const;
export type DistribuidoraAuditAction = (typeof AUDIT_ACTIONS)[number];

export type DistribuidoraAuditContext = {
  deviceId?: string;
  userAgent?: string;
};

export const ORDER_STATUSES = ["pendiente", "facturado"] as const;
export type DistribuidoraOrderStatus = (typeof ORDER_STATUSES)[number];

export type DistribuidoraOrder = {
  id: number;
  clientId: number | null;
  clientName: string;
  clientRut: string | null;
  clientAddress: string | null;
  items: DistribuidoraOrderItem[];
  total: number;
  note: string | null;
  // Nombre de quien tomo el pedido (02/11/2026, pedido explicito). Foto
  // del nombre al momento de la venta, igual que clientName/clientRut.
  soldBy: string | null;
  status: DistribuidoraOrderStatus;
  invoiceNumber: number | null;
  invoicedAt: string | null;
  createdAt: string;
};

export const DISTRIBUIDORA_ROLES = ["admin", "vendedor"] as const;
export type DistribuidoraRole = (typeof DISTRIBUIDORA_ROLES)[number];
