-- Porcentaje de comision de cada usuario (02/11/2026, pedido explicito):
-- "Comisión" en Oficina muestra lo que vendio cada vendedor y cuanto se
-- le paga segun este porcentaje. Admin lo puede editar por usuario.
ALTER TABLE saas_distribuidora_users
  ADD COLUMN commission_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00 AFTER role;
