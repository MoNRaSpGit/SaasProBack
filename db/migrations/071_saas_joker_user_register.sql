-- Caja propia del Usuario, separada de la caja global del Administrador
-- (saas_joker_register_state/saas_joker_register_closes, sin tocar). A
-- diferencia de esa, esta arranca CERRADA (is_open = 0): el Usuario tiene
-- que abrirla a mano poniendo el monto inicial antes de que su Panel
-- cuente algo como "de su caja". initial_cash queda NULL mientras esta
-- cerrada, y se carga de nuevo cada vez que se abre.
CREATE TABLE IF NOT EXISTS saas_joker_user_register_state (
  id TINYINT UNSIGNED NOT NULL,
  is_open TINYINT(1) NOT NULL DEFAULT 0,
  initial_cash DECIMAL(12,2) NULL,
  opened_at DATETIME NULL,
  last_closed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO saas_joker_user_register_state (id, is_open, initial_cash, opened_at, last_closed_at) VALUES (1, 0, NULL, NULL, NULL);

CREATE TABLE IF NOT EXISTS saas_joker_user_register_closes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  closed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  initial_cash DECIMAL(12,2) NOT NULL,
  total_vendido DECIMAL(12,2) NOT NULL,
  ganancia DECIMAL(12,2) NOT NULL,
  payment_totals JSON NOT NULL,
  ranking JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_user_register_closes_closed_at (closed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
