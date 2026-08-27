-- Guarda que cliente eligio un pedido pagado "a cuenta", ademas del nombre
-- libre que ya se guardaba. Hace falta para los pedidos pendientes de
-- mostrador: si se pagan a cuenta, recien al aceptarlos (no al crearlos)
-- se genera el movimiento de cuenta corriente, y para eso hace falta saber
-- a que cliente cargarlo sin tener que volver a preguntar.
ALTER TABLE saas_joker_orders
  ADD COLUMN client_id BIGINT UNSIGNED NULL AFTER customer_name,
  ADD CONSTRAINT fk_saas_joker_orders_client
    FOREIGN KEY (client_id) REFERENCES saas_joker_clients(id) ON DELETE SET NULL,
  ADD INDEX idx_saas_joker_orders_client_id (client_id);
