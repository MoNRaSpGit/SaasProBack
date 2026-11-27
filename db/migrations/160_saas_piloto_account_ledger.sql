-- Piloto, cuenta corriente con historial (27/11/2026). Aditiva: no borra ni
-- modifica ninguna fila existente.
--  * Nada se borra mas: al saldar, los movimientos quedan "cerrados" por el
--    pago que dejo la cuenta en cero (closed_by_payment_id).
--  * Pagos parciales en su propia tabla.
--  * request_id evita registrar dos veces lo mismo (doble toque / mala senal).
--  * voided_at: correcciones que hacemos nosotros, sin borrar.
--  * Borrar cliente pasa a ser logico y la clave foranea ya no arrastra boletas.
ALTER TABLE saas_piloto_clients
  ADD COLUMN deleted_at DATETIME NULL;

ALTER TABLE saas_piloto_account_entries
  ADD COLUMN request_id VARCHAR(64) NULL,
  ADD COLUMN closed_by_payment_id INT NULL,
  ADD COLUMN voided_at DATETIME NULL,
  ADD COLUMN void_reason VARCHAR(200) NULL,
  ADD UNIQUE KEY uq_piloto_entry_request (request_id);

ALTER TABLE saas_piloto_account_entries
  DROP FOREIGN KEY fk_piloto_account_entry_client;

ALTER TABLE saas_piloto_account_entries
  ADD CONSTRAINT fk_piloto_account_entry_client_keep FOREIGN KEY (client_id) REFERENCES saas_piloto_clients (id);

CREATE TABLE IF NOT EXISTS saas_piloto_account_payments (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  closed_by_payment_id INT NULL,
  voided_at DATETIME NULL,
  void_reason VARCHAR(200) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_piloto_payment_request (request_id),
  KEY idx_piloto_payment_client (client_id, created_at),
  KEY idx_piloto_payment_created (created_at),
  CONSTRAINT fk_piloto_payment_client FOREIGN KEY (client_id) REFERENCES saas_piloto_clients (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
