-- Liquidacion del camionero (15/11/2026): fecha en que se le pago el viaje.
-- NULL = todavia no se le pago. Al "pagarle" se marcan sus viajes valorados.
ALTER TABLE saas_camiones_trips
  ADD COLUMN driver_paid_at DATETIME NULL AFTER paid_at;
