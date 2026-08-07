-- Carrito con varios productos: el checkout ahora arma UNA preferencia de
-- Mercado Pago con varias lineas. Guardamos el detalle de cada carrito antes
-- de mandarlo a Mercado Pago (por external_reference), asi el webhook sabe
-- exactamente que se compro y a que precio, sin depender de que Mercado
-- Pago devuelva el desglose por item.
CREATE TABLE IF NOT EXISTS saas_camisetas_pending_orders (
  order_ref VARCHAR(64) NOT NULL,
  items_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE saas_camisetas_sales
  ADD COLUMN quantity INT UNSIGNED NOT NULL DEFAULT 1 AFTER unit_price;

-- Antes un pago = una fila (UNIQUE por mp_payment_id). Ahora un pago puede
-- traer varias camisetas distintas, asi que la fila unica pasa a ser
-- pago + producto.
ALTER TABLE saas_camisetas_sales
  DROP INDEX uq_saas_camisetas_sales_payment,
  ADD UNIQUE KEY uq_saas_camisetas_sales_payment_product (mp_payment_id, product_id);
