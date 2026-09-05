-- Gastos del Administrador (mozzarella, bombones, etc.) durante el turno --
-- reemplaza al ranking de productos, que no se usaba, en el Panel de
-- control y en el ticket de cierre de caja. Se resetea con cada cierre
-- (se filtra por created_at > last_closed_at, igual que los pedidos y los
-- movimientos de caja de los repartidores).
CREATE TABLE IF NOT EXISTS saas_joker_admin_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_admin_expenses_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot de esos gastos en el cierre de caja, igual que ya se hace con
-- ranking/mostrador_total -- para que el historial de cierres quede
-- completo aunque saas_joker_admin_expenses siga acumulando turnos
-- futuros. NULL en cierres viejos, de antes de esta funcionalidad.
ALTER TABLE saas_joker_register_closes
  ADD COLUMN admin_expenses JSON NULL DEFAULT NULL,
  ADD COLUMN admin_expenses_total DECIMAL(12,2) NULL DEFAULT NULL;
