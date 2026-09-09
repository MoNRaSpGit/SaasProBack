-- Auditoria de cuenta corriente: registra cada vez que se crea, edita o
-- borra un movimiento de saas_joker_account_entries, y por que (pedido
-- nuevo a cuenta, pedido editado, metodo de pago cambiado, pedido
-- cancelado). Antes de esto, un pedido "a cuenta" editado o pasado a otro
-- metodo de pago podia perder su movimiento sin dejar rastro de que existio
-- ni de cual era el valor anterior -- este log es autonomo, sin pantalla en
-- la app por ahora (se consulta con scripts/inspect-joker-account-audit.js,
-- mismo criterio que el auditLog interno de frontend-agro).
CREATE TABLE IF NOT EXISTS saas_joker_account_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id INT NOT NULL,
  entry_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  action VARCHAR(20) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  actor_role VARCHAR(20) NULL,
  previous_total DECIMAL(12,2) NULL,
  previous_items JSON NULL,
  new_total DECIMAL(12,2) NULL,
  new_items JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_account_audit_log_client (client_id, created_at),
  KEY idx_saas_joker_account_audit_log_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
