-- Quien tomo el pedido (02/11/2026, pedido explicito: "que quede el
-- nombre de la persona que vendio"). Foto del nombre al momento de la
-- venta, igual que client_name/client_rut: si despues se renombra el
-- usuario, los pedidos viejos no cambian.
ALTER TABLE saas_distribuidora_orders
  ADD COLUMN sold_by VARCHAR(120) NULL AFTER note;
