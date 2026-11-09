-- Santi (demo de cobros, clientes, menu semanal e historial de pagos).
-- Los datos de ejemplo los carga el servicio solo si las tablas estan
-- vacias (o con POST /santi/reset).
CREATE TABLE IF NOT EXISTS saas_santi_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NULL,
  owes INT NOT NULL DEFAULT 0,
  today_menu_name VARCHAR(120) NOT NULL,
  today_menu_items TEXT NOT NULL,
  today_menu_note VARCHAR(255) NOT NULL DEFAULT '',
  weekly_menu_id INT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_santi_menus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  items TEXT NOT NULL,
  in_week TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_santi_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  amount INT NOT NULL,
  method VARCHAR(30) NOT NULL,
  paid_on DATE NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_saas_santi_payments_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_santi_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  day_name VARCHAR(12) NOT NULL,
  dish VARCHAR(160) NOT NULL,
  UNIQUE KEY uq_saas_santi_history (client_id, day_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
