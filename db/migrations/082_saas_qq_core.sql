-- frontend-qq: catalogo de productos con buscador + tarjetas (estilo
-- Netflix: buscador arriba, grilla de tarjetas debajo). Arranque simple a
-- proposito -- el usuario dijo "vamos a arrancar con esto y despues
-- vamos a los detalles" (14/09/2026).
CREATE TABLE IF NOT EXISTS saas_qq_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(500) NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(5) NOT NULL DEFAULT 'UYU',
  image_url VARCHAR(500) NULL,
  category VARCHAR(100) NULL,
  status ENUM('published', 'draft') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_qq_products_status (status),
  KEY idx_saas_qq_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
