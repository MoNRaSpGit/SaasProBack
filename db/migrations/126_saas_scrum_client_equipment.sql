-- Materiales / equipo de un cliente de Scrum (14/11/2026): el equipo lo compra
-- Logic Lab y se lo cobra al cliente aparte, en cuotas (ej: $200 x 10 meses).
-- NO suma a la ganancia mensual (esa es solo de los programas).
-- Un plan por cliente + los pagos que va haciendo (monto libre: cuota,
-- doble cuota, o todo de golpe).

CREATE TABLE IF NOT EXISTS saas_scrum_client_equipment (
  client_id BIGINT UNSIGNED NOT NULL,
  installment_amount DECIMAL(12, 2) NOT NULL,
  months INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id),
  CONSTRAINT fk_saas_scrum_client_equipment_client
    FOREIGN KEY (client_id) REFERENCES saas_scrum_clients (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_scrum_client_equipment_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_scrum_client_equipment_payments_client (client_id),
  CONSTRAINT fk_saas_scrum_client_equipment_payments_client
    FOREIGN KEY (client_id) REFERENCES saas_scrum_clients (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
