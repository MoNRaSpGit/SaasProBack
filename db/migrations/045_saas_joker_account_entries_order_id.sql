-- Vincula cada movimiento de cuenta corriente con el pedido que lo genero,
-- para que al editar un pedido "a cuenta" se pueda encontrar y actualizar
-- el movimiento correspondiente (antes quedaban desfasados).
ALTER TABLE saas_joker_account_entries
  ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER client_id,
  ADD CONSTRAINT fk_joker_account_entries_order
    FOREIGN KEY (order_id) REFERENCES saas_joker_orders(id) ON DELETE SET NULL,
  ADD INDEX idx_joker_account_entries_order_id (order_id);
