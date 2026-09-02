-- "Mostrador" como una tarjeta mas en Delivery (ver JokerCourierService):
-- el Administrador la habilita/liquida igual que a un repartidor, pero
-- sus pedidos y su plata cobrada salen de las ventas de mostrador/rol
-- Usuario, no de pedidos con courier_id asignado. is_counter marca cual
-- de las filas es esa -- deberia haber una sola siempre.
ALTER TABLE saas_joker_couriers
  ADD COLUMN is_counter TINYINT(1) NOT NULL DEFAULT 0;

INSERT INTO saas_joker_couriers (name, is_counter)
SELECT 'Mostrador', 1
WHERE NOT EXISTS (SELECT 1 FROM saas_joker_couriers WHERE is_counter = 1);
