-- Desglose por origen en el cierre de la caja general: cuanto de
-- total_vendido vino de mostrador/rol Usuario (el resto, total_vendido -
-- mostrador_total, es lo del Administrador). NULL en cierres viejos, de
-- antes de que la caja general incluyera las ventas de mostrador.
ALTER TABLE saas_joker_register_closes
  ADD COLUMN mostrador_total DECIMAL(12,2) NULL DEFAULT NULL;
