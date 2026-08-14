-- Movimientos de caja de cada repartidor durante el turno: cuanto arranco
-- llevando (inicial), cuanto gasto comprando algo para el local (gasto,
-- ej: insumos) y cuanto le fue entregando al local para no andar con todo
-- el efectivo encima (entrega). Junto con el efectivo cobrado en los
-- pedidos que reparte (saas_joker_orders.payment_method = 'efectivo'), esto
-- arma la "caja actual" del repartidor. Se resetea con cada cierre de caja
-- (se filtra por created_at > last_closed_at, igual que los pedidos).
CREATE TABLE IF NOT EXISTS saas_joker_courier_cash_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  courier_id BIGINT UNSIGNED NOT NULL,
  type ENUM('inicial', 'gasto', 'entrega') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_courier_cash_movements_courier (courier_id),
  CONSTRAINT fk_saas_joker_courier_cash_movements_courier
    FOREIGN KEY (courier_id) REFERENCES saas_joker_couriers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
