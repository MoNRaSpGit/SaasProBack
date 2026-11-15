-- Tipo de cobro por producto (14/11/2026): "por mes" (lo que hubo hasta
-- ahora) o "precio unico" (se paga una sola vez). Los productos que ya
-- existen quedan en "monthly".
ALTER TABLE saas_qq_products
  ADD COLUMN billing_type ENUM('monthly','one_time') NOT NULL DEFAULT 'monthly' AFTER currency;
