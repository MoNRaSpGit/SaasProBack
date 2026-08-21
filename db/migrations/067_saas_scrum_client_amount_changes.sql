-- Historial de cambios de monto de un cliente scrum (ej: "500 -> 600,
-- descripcion: solucion de caja registradora"). La tabla se crea sola
-- desde ScrumService.ensureTables() (CREATE TABLE IF NOT EXISTS), esta
-- migracion queda como registro.

CREATE TABLE IF NOT EXISTS saas_scrum_client_amount_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  previous_amount DECIMAL(12, 2) NOT NULL,
  new_amount DECIMAL(12, 2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_scrum_client_amount_changes_client (client_id),
  CONSTRAINT fk_saas_scrum_client_amount_changes_client
    FOREIGN KEY (client_id) REFERENCES saas_scrum_clients (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
