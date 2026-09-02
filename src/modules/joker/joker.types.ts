export type JokerChatSenderRole = "administrador" | "usuario";

export type JokerChatMessage = {
  id: number;
  senderRole: JokerChatSenderRole;
  message: string;
  createdAt: string;
};

export type JokerProductType = "simple" | "extra";
export type JokerProductStatus = "draft" | "published";
export type JokerPricingUnit = "unidad" | "kg";

// Slot de eleccion dentro de un combo (ej: "Hamburguesa" o "Refresco"). El
// operario elige uno de option_product_ids al cargar el combo, y ese
// producto (con su propia receta ya cargada) es lo que se descuenta del
// stock, ademas del combo en si.
export type JokerComboSlot = {
  label: string;
  quantity: number;
  optionProductIds: number[];
};

export type JokerProduct = {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  subcategoryDetail: string | null;
  brand: string | null;
  price: number;
  ingredients: string | null;
  observations: string | null;
  productType: JokerProductType;
  status: JokerProductStatus;
  pricingUnit: JokerPricingUnit;
  createdAt: string;
  updatedAt: string;
  comboSlots?: JokerComboSlot[];
};

export type JokerOrderItem = {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  detail?: string;
};

export type JokerPaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "cuenta";

export type JokerOrderStatus = "confirmado" | "pendiente" | "rechazado";

// Quien cargo el pedido -- se graba una sola vez al crearlo y no se toca
// mas, ni siquiera cuando un pedido "pendiente" del Usuario pasa a
// "confirmado" al aceptarlo.
export type JokerOrderOriginRole = "administrador" | "usuario";

export type JokerOrder = {
  id: number;
  displayNumber: number | null;
  status: JokerOrderStatus;
  originRole: JokerOrderOriginRole;
  total: number;
  address: string;
  paymentMethod: JokerPaymentMethod;
  customerName: string | null;
  clientId: number | null;
  items: JokerOrderItem[];
  createdAt: string;
  orderDate: string | null;
  courierId: number | null;
  deliveryCost: number | null;
};

export type JokerCourierStatus = "inactivo" | "activo";

export type JokerCourier = {
  id: number;
  name: string;
  status: JokerCourierStatus;
  activeSince: string | null;
  // "Mostrador": la tarjeta especial (unica) que representa las ventas de
  // mostrador/rol Usuario en Delivery -- el Administrador la habilita y
  // liquida igual que a un repartidor, pero sus pedidos y su plata
  // cobrada salen de las ventas del Usuario, no de pedidos con courier_id
  // asignado (ver JokerCourierService).
  isCounter: boolean;
};

export type JokerCourierCashMovementType = "inicial" | "gasto" | "entrega";

export type JokerCourierCashMovement = {
  id: number;
  type: JokerCourierCashMovementType;
  amount: number;
  description: string | null;
  createdAt: string;
};

// Caja del repartidor durante el turno actual (desde el ultimo cierre):
// cashOnHand = initialCash + ordersCashTotal - expensesTotal -
// handoversTotal. movements trae solo gasto/entrega (el "inicial" ya esta
// resumido en initialCash) para listar el historial en la UI.
export type JokerCourierCashSummary = {
  initialCash: number;
  ordersCashTotal: number;
  ordersCashCount: number;
  expensesTotal: number;
  handoversTotal: number;
  cashOnHand: number;
  movements: JokerCourierCashMovement[];
};

// Copia permanente de la caja del repartidor al momento de liquidar (igual
// que saas_joker_account_settlements para cuenta corriente), por si
// despues hay que reclamar o verificar algo de un turno ya cerrado.
export type JokerCourierSettlement = {
  id: number;
  courierId: number;
  courierName: string;
  initialCash: number;
  ordersCashTotal: number;
  ordersCashCount: number;
  expensesTotal: number;
  handoversTotal: number;
  cashOnHand: number;
  movements: JokerCourierCashMovement[];
  hourlyRate: number;
  hoursWorked: number;
  hoursTotal: number;
  deliveryCostTotal: number;
  payoutTotal: number;
  activeSince: string | null;
  settledAt: string;
};

export type JokerClient = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
};

export type JokerAccountEntryItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type JokerAccountEntry = {
  id: number;
  clientId: number;
  orderId: number | null;
  total: number;
  items: JokerAccountEntryItem[];
  createdAt: string;
  orderDate: string | null;
};

// Copia permanente de un consumo de cuenta corriente al momento en que se
// paga o el cliente se elimina (ver joker.service.ts#archiveClientEntries).
export type JokerAccountSettlement = {
  id: number;
  clientId: number;
  clientName: string;
  entryId: number;
  total: number;
  items: JokerAccountEntryItem[];
  entryCreatedAt: string;
  reason: "pago" | "cliente_eliminado" | "correccion_manual";
  settledAt: string;
};

// A que boleta(s) (account entries) correspondio un pago, calculado por
// orden de antiguedad (FIFO) en el momento de registrarlo -- es una
// instantanea para mostrar "este pago cubrio tal boleta", no algo que se
// vuelva a recalcular despues.
export type JokerAccountPaymentCoveredEntry = {
  entryId: number;
  orderId: number | null;
  entryTotal: number;
  amountApplied: number;
};

// Pago (parcial o total) de cuenta corriente. Nunca se borra -- queda de
// historial permanente aunque el cliente despues vuelva a generar deuda.
// settledAt no-null significa que este pago fue parte de un ciclo que
// termino en pago total (las boletas de ese ciclo ya se archivaron); null
// significa que el ciclo sigue abierto y este pago todavia cuenta para el
// saldo actual del cliente.
export type JokerAccountPayment = {
  id: number;
  clientId: number;
  amount: number;
  coveredEntries: JokerAccountPaymentCoveredEntry[];
  createdAt: string;
  settledAt: string | null;
};

export type JokerStockItemCategory = "comida" | "bebida" | "otro";

export type JokerStockItem = {
  id: number;
  name: string;
  unit: string;
  category: JokerStockItemCategory;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type JokerProductRecipeLine = {
  stockItemId: number;
  stockItemName: string;
  unit: string;
  quantityPerUnit: number;
};

export type JokerRegisterState = {
  isOpen: boolean;
  lastClosedAt: string | null;
};

export type JokerRegisterPaymentTotals = Record<JokerPaymentMethod, number>;

export type JokerRegisterCloseRankingItem = {
  productName: string;
  quantity: number;
};

export type JokerRegisterClose = {
  id: number;
  closedAt: string;
  totalVendido: number;
  ganancia: number;
  paymentTotals: JokerRegisterPaymentTotals;
  ranking: JokerRegisterCloseRankingItem[];
};

// ---------- Mes (dia comercial: 5am a 5am, ver STORE_DAY_START_HOUR) ----------

// Cierre diario congelado, usado por "Mes" como fuente de verdad para
// cualquier dia comercial que ya lo tenga -- ver joker.service.ts para el
// cron que lo genera y editarCierreDia para la correccion manual.
export type JokerCierreDia = {
  fecha: string;
  total: number;
  editadoManualmente: boolean;
};

export type JokerMonthDay = {
  fecha: string;
  diaSemana: string;
  total: number;
  // true si ya paso por el cierre automatico de las 5am (o se corrigio a
  // mano) -- ese valor es la fuente de verdad. false = todavia se esta
  // calculando en vivo (tipicamente el dia comercial de hoy).
  cerrado: boolean;
};

export type JokerMonthWeek = {
  numero: number;
  dias: JokerMonthDay[];
  total: number;
};

export type JokerMonthSummary = {
  anio: number;
  mes: number;
  total: number;
  semanas: JokerMonthWeek[];
};

export type JokerMonthHistoryItem = {
  anio: number;
  mes: number;
  total: number;
};
