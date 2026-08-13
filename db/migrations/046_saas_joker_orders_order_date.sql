-- Fecha "logica" del pedido, editable a mano (para cargar pedidos a cuenta
-- que se olvidaron y se ingresan varios dias despues). Si queda NULL, se usa
-- la fecha de created_at como siempre. No reemplaza a created_at (que sigue
-- siendo la fecha real de carga en el sistema, usada para cierres de caja,
-- numeracion de tickets y el periodo actual).
ALTER TABLE saas_joker_orders
  ADD COLUMN order_date DATE NULL AFTER created_at;
