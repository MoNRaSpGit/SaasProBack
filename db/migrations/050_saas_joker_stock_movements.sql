-- Historial de movimientos de stock: cada venta que descuenta un insumo
-- (y cada reposicion/ajuste manual) queda registrada aca, para poder
-- mostrar despues "este insumo se gasto en estos productos" (ej: Churrasco
-- de hamburguesa -> Hamburguesa Clasica x1, Hamburguesa con queso x3). Sin
-- FK a productos/pedidos a proposito: el historial tiene que sobrevivir
-- aunque el producto o el pedido se borren despues.
CREATE TABLE IF NOT EXISTS saas_joker_stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(180) NULL,
  order_id BIGINT UNSIGNED NULL,
  quantity_delta DECIMAL(12,2) NOT NULL,
  reason ENUM('venta', 'restock', 'ajuste_manual') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_stock_movements_stock_item (stock_item_id),
  KEY idx_saas_joker_stock_movements_created_at (created_at),
  CONSTRAINT fk_saas_joker_stock_movements_stock_item
    FOREIGN KEY (stock_item_id) REFERENCES saas_joker_stock_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
