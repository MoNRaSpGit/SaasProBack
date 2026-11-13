-- Comision por cliente de Scrum (14/11/2026): porcentaje que Logic Lab le da
-- a quien vendio el proyecto (ej: 50). La ganancia mensual cuenta solo lo que
-- queda para nosotros (monto - comision); la comision va en su propia tarjeta.
ALTER TABLE saas_scrum_clients
  ADD COLUMN commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;
