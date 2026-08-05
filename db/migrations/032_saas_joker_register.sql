CREATE TABLE IF NOT EXISTS saas_joker_register_state (
  id TINYINT UNSIGNED NOT NULL,
  is_open TINYINT(1) NOT NULL DEFAULT 1,
  last_closed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO saas_joker_register_state (id, is_open, last_closed_at) VALUES (1, 1, NULL);

CREATE TABLE IF NOT EXISTS saas_joker_register_closes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  closed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_vendido DECIMAL(12,2) NOT NULL,
  ganancia DECIMAL(12,2) NOT NULL,
  payment_totals JSON NOT NULL,
  ranking JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_register_closes_closed_at (closed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
