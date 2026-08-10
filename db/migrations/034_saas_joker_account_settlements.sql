-- Respaldo/auditoria de cuenta corriente: antes de borrar un consumo (por
-- pago del cliente o por eliminacion del cliente), se guarda una copia aca
-- para siempre. No tiene FK a clientes ni a account_entries a proposito:
-- tiene que sobrevivir aunque el cliente se elimine.
CREATE TABLE IF NOT EXISTS saas_joker_account_settlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  client_name VARCHAR(180) NOT NULL,
  entry_id BIGINT UNSIGNED NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  items JSON NOT NULL,
  entry_created_at DATETIME NOT NULL,
  reason ENUM('pago', 'cliente_eliminado') NOT NULL,
  settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_account_settlements_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
