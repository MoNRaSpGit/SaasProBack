export type GymExpense = {
  id: string;
  name: string;
  amount: number;
  intervalDays: number;
  dueDate: string;
  lastPaidAt: string | null;
  createdAt: string;
};

export type GymTaskColor = "green" | "yellow" | "red";
export type GymTaskStatus = "todo" | "in_progress" | "done";

export type GymTask = {
  id: string;
  title: string;
  color: GymTaskColor;
  status: GymTaskStatus;
  createdAt: string;
};

export type GymMovementType = "cobro" | "gasto" | "cliente_nuevo" | "otro";

export type GymMovement = {
  id: string;
  date: string;
  type: GymMovementType;
  amount: number | null;
  note: string;
  createdAt: string;
};

export type GymAuditAction =
  | "login"
  | "expense_created"
  | "expense_paid"
  | "expense_deleted"
  | "task_created"
  | "task_moved"
  | "task_deleted"
  | "movement_created"
  | "movement_deleted";

export type GymAuditEntry = {
  id: string;
  action: GymAuditAction;
  timestamp: string;
  details: string;
};

export type GymWorkspaceData = {
  expenses: GymExpense[];
  tasks: GymTask[];
  movements: GymMovement[];
  auditLog: GymAuditEntry[];
};

export type GymWorkspaceRecord = {
  data: GymWorkspaceData;
  rowVersion: number;
  updatedAt: string | null;
};

export function emptyGymWorkspaceData(): GymWorkspaceData {
  return { expenses: [], tasks: [], movements: [], auditLog: [] };
}
