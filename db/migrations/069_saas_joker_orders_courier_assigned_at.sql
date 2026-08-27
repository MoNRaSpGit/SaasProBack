-- Fecha en que se asigno (o reasigno) un repartidor a un pedido, separada
-- de created_at del pedido. Antes, listCurrentPeriodOrders/getCourierCashSummary
-- comparaban created_at del pedido contra active_since del repartidor -- si
-- el pedido era mas viejo que el ultimo "Habilitar" del repartidor, quedaba
-- invisible para el aunque se lo acabara de asignar. Los pedidos que ya
-- tenian repartidor asignado se backfillean con su created_at para no
-- perder asignaciones existentes.
ALTER TABLE saas_joker_orders
  ADD COLUMN courier_assigned_at DATETIME NULL AFTER courier_id;

UPDATE saas_joker_orders
SET courier_assigned_at = created_at
WHERE courier_id IS NOT NULL AND courier_assigned_at IS NULL;
