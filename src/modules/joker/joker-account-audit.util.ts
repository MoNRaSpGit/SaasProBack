import { DatabaseService } from "../../shared/database/database.service";

// Un solo lugar para dejar rastro cada vez que se crea, edita o borra un
// movimiento de saas_joker_account_entries -- lo usan tanto
// JokerAccountService (alta directa, desde Pedidos/aceptar pendiente) como
// JokerOrdersService (que toca account_entries directo al editar un pedido
// ya guardado: cambiar metodo de pago, corregir items, cancelar). Sin esto,
// esas ediciones/borrados desde pedidos quedaban sin ningun registro de que
// existieron ni de cual era el valor anterior.
export type JokerAccountAuditAction = "creado" | "editado" | "eliminado";

export type JokerAccountAuditItem = { productName: string; quantity: number; unitPrice: number };

export type JokerAccountAuditInput = {
  clientId: number;
  entryId: number | null;
  orderId: number | null;
  action: JokerAccountAuditAction;
  reason: string;
  actorRole?: string | null;
  previousTotal?: number | null;
  previousItems?: JokerAccountAuditItem[] | null;
  newTotal?: number | null;
  newItems?: JokerAccountAuditItem[] | null;
};

export async function logAccountEntryAudit(databaseService: DatabaseService, input: JokerAccountAuditInput): Promise<void> {
  await databaseService.execute(
    `INSERT INTO saas_joker_account_audit_log
       (client_id, entry_id, order_id, action, reason, actor_role, previous_total, previous_items, new_total, new_items)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.clientId,
      input.entryId,
      input.orderId,
      input.action,
      input.reason,
      input.actorRole ?? null,
      input.previousTotal ?? null,
      input.previousItems ? JSON.stringify(input.previousItems) : null,
      input.newTotal ?? null,
      input.newItems ? JSON.stringify(input.newItems) : null
    ]
  );
}
