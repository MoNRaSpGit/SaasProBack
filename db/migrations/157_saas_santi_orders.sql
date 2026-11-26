-- Santi: pedidos de viandas (semanal o por dia) y los dias que incluye cada uno.
CREATE TABLE IF NOT EXISTS saas_santi_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  kind VARCHAR(10) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  total INT NOT NULL DEFAULT 0,
  pay_status VARCHAR(10) NOT NULL,
  paid_amount INT NOT NULL DEFAULT 0,
  note VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  KEY idx_saas_santi_orders_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_santi_order_days (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  delivery_date DATE NOT NULL,
  menu_id INT NOT NULL,
  menu_name VARCHAR(120) NOT NULL,
  KEY idx_saas_santi_order_days_date (delivery_date),
  KEY idx_saas_santi_order_days_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
