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

export type GymStudentPlan = "mensual" | "trimestral" | "semestral" | "anual";

// Categoria/deporte del alumno (01/10/2026). Ver espejo en el frontend
// (gym.types.ts) -- aca no se valida campo por campo (students viaja
// como unknown[] en el DTO), pero el tipo documenta la forma real.
export type GymStudentCategory = "gimnasio" | "futbol" | "voley" | "basquet" | "otro";

export type GymStudent = {
  id: string;
  name: string;
  phone: string;
  fee: number | null;
  plan: GymStudentPlan;
  category: GymStudentCategory;
  dueDate: string;
  note: string;
  lastPaidAt: string | null;
  createdAt: string;
};

export type GymCheckIn = {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  wasOverdue: boolean;
};

// Medicion de un alumno (pestana "Mi Progreso", 10/10/2026). Todas las
// medidas son opcionales (null = ese dia no se midio). Ver espejo en el
// frontend (gym.types.ts) -- aca no se valida campo por campo
// (progressRecords viaja como unknown[] en el DTO).
export type GymProgressRecord = {
  id: string;
  studentId: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  bicepsCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  thighCm: number | null;
  bodyFatPct: number | null;
  note: string;
  createdAt: string;
};

export type GymAuditAction =
  | "login"
  | "login_failed"
  | "expense_created"
  | "expense_paid"
  | "expense_deleted"
  | "task_created"
  | "task_moved"
  | "task_deleted"
  | "movement_created"
  | "movement_deleted"
  | "student_created"
  | "student_renewed"
  | "student_updated"
  | "student_deleted"
  | "student_checkin"
  | "progress_created"
  | "progress_deleted";

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
  students: GymStudent[];
  checkIns: GymCheckIn[];
  progressRecords: GymProgressRecord[];
  auditLog: GymAuditEntry[];
};

export type GymWorkspaceRecord = {
  data: GymWorkspaceData;
  rowVersion: number;
  updatedAt: string | null;
};

export function emptyGymWorkspaceData(): GymWorkspaceData {
  return { expenses: [], tasks: [], movements: [], students: [], checkIns: [], progressRecords: [], auditLog: [] };
}
