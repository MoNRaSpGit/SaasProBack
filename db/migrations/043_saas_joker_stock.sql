-- Insumos de stock (churrasco de hamburguesa, pan de pancho, lata de cerveza, etc.)
CREATE TABLE IF NOT EXISTS saas_joker_stock_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'unidad',
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_joker_stock_items_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Receta: que insumos (y cuanto de cada uno) consume un producto vendible por
-- cada unidad vendida. Un producto sin filas aca no descuenta stock.
CREATE TABLE IF NOT EXISTS saas_joker_product_recipes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  quantity_per_unit DECIMAL(12,2) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_joker_product_recipes_product_stock (product_id, stock_item_id),
  KEY idx_saas_joker_product_recipes_product (product_id),
  KEY idx_saas_joker_product_recipes_stock (stock_item_id),
  CONSTRAINT fk_saas_joker_product_recipes_product
    FOREIGN KEY (product_id) REFERENCES saas_joker_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_saas_joker_product_recipes_stock
    FOREIGN KEY (stock_item_id) REFERENCES saas_joker_stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
