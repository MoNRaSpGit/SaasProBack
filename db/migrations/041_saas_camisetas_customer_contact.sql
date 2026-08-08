-- Datos de contacto del comprador (nombre + celular), pedidos ANTES de ir a
-- Mercado Pago y guardados junto con el carrito pendiente. seq_id da un
-- numero correlativo propio para armar un codigo de pedido corto y
-- legible (PDH-0001, PDH-0002, ...) en vez de usar el ID larguisimo que
-- da Mercado Pago.
ALTER TABLE saas_camisetas_pending_orders
  ADD COLUMN seq_id BIGINT UNSIGNED AUTO_INCREMENT UNIQUE,
  ADD COLUMN customer_name VARCHAR(160) NULL,
  ADD COLUMN customer_phone VARCHAR(40) NULL;

ALTER TABLE saas_camisetas_sales
  ADD COLUMN order_code VARCHAR(20) NULL,
  ADD COLUMN customer_name VARCHAR(160) NULL,
  ADD COLUMN customer_phone VARCHAR(40) NULL;
