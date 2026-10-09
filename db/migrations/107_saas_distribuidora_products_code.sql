-- Catalogo real de la distribuidora (09/10/2026): los productos vienen de
-- la planilla del sistema anterior con un codigo propio y una categoria.
-- El codigo es unico (permite recargar la planilla sin duplicar) pero
-- opcional: los productos dados de alta a mano desde la app no lo llevan.
ALTER TABLE saas_distribuidora_products
  ADD COLUMN code VARCHAR(40) NULL AFTER id,
  ADD COLUMN category VARCHAR(40) NULL AFTER name,
  ADD UNIQUE KEY uq_distribuidora_products_code (code);
