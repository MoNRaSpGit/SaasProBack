CREATE TABLE IF NOT EXISTS saas_joker_courier_settlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  courier_id BIGINT UNSIGNED NOT NULL,
  courier_name VARCHAR(255) NOT NULL,
  initial_cash DECIMAL(12,2) NOT NULL,
  orders_cash_total DECIMAL(12,2) NOT NULL,
  orders_cash_count INT UNSIGNED NOT NULL,
  expenses_total DECIMAL(12,2) NOT NULL,
  handovers_total DECIMAL(12,2) NOT NULL,
  cash_on_hand DECIMAL(12,2) NOT NULL,
  movements JSON NOT NULL,
  active_since DATETIME NULL,
  settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_courier_settlements_courier (courier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
