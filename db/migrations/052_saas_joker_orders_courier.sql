-- Vincula el pedido con el repartidor que lo lleva y guarda el costo de
-- envio de una vez (antes se calculaba en el frontend para el ticket pero
-- nunca se guardaba en la base, asi que no se podia usar despues para la
-- liquidacion del delivery).
ALTER TABLE saas_joker_orders
  ADD COLUMN courier_id BIGINT UNSIGNED NULL AFTER address,
  ADD COLUMN delivery_cost DECIMAL(12,2) NULL AFTER courier_id,
  ADD CONSTRAINT fk_saas_joker_orders_courier
    FOREIGN KEY (courier_id) REFERENCES saas_joker_couriers(id) ON DELETE SET NULL,
  ADD INDEX idx_saas_joker_orders_courier_id (courier_id);
