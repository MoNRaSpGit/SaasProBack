-- Deudas propias del proyecto scrum (ej: "Comida Rapida" $500, con cargos
-- que se le van sumando y pagos totales/parciales que se le van restando).
-- Las tablas se crean solas desde ScrumService.ensureTables() (CREATE TABLE
-- IF NOT EXISTS), esta migracion queda como registro.

CREATE TABLE IF NOT EXISTS saas_scrum_debts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  initial_amount DECIMAL(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_scrum_debt_charges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  debt_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  detail VARCHAR(255) NOT NULL,
  charged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_scrum_debt_charges_debt (debt_id),
  CONSTRAINT fk_saas_scrum_debt_charges_debt
    FOREIGN KEY (debt_id) REFERENCES saas_scrum_debts (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_scrum_debt_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  debt_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_scrum_debt_payments_debt (debt_id),
  CONSTRAINT fk_saas_scrum_debt_payments_debt
    FOREIGN KEY (debt_id) REFERENCES saas_scrum_debts (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
