-- Gastos mensuales de Scrum (14/11/2026): lo que cuesta mantener el negocio
-- (Claude, servidor, YouTube Premium...). Cada gasto es un monto POR MES y se
-- descuenta de la ganancia mensual para dar la ganancia neta.
CREATE TABLE IF NOT EXISTS saas_scrum_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  description VARCHAR(180) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
