CREATE TABLE IF NOT EXISTS saas_joker_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Otros',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_products_category (category),
  KEY idx_saas_joker_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO saas_joker_products (name, category, price) VALUES
  ('Hamburguesa Clasica', 'Hamburguesas', 0),
  ('Hamburguesa Doble Cheddar', 'Hamburguesas', 0),
  ('Pancho Especial', 'Panchos', 0),
  ('Papas Cheddar y Panceta', 'Papas', 0),
  ('Wrap de Pollo', 'Otros', 0),
  ('Papas Fritas', 'Papas', 0);
