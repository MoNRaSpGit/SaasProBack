-- Nombre de quien pago, para poder rastrear pagos por cuenta corriente o
-- transferencia (ej: "Juan - Transferencia - Pedido #18"). Opcional: solo
-- se completa en esos dos metodos de pago.
ALTER TABLE saas_joker_orders
  ADD COLUMN customer_name VARCHAR(160) NULL;
