-- Dos precios por producto (16/09/2026): "precio por perfil" y "precio
-- por cuenta" -- hay tarjetas que llevan los dos, otras solo uno. La
-- columna "price" que ya existia pasa a llamarse "account_price" (ahi
-- vivia el precio de cada producto hasta ahora, es el equivalente mas
-- cercano a "precio de cuenta") y deja de ser obligatoria; se agrega
-- "profile_price", tambien opcional. La validacion de "al menos uno de
-- los dos tiene que estar cargado" se hace en el backend (DTO/service),
-- no aca.
ALTER TABLE saas_qq_products
  CHANGE COLUMN price account_price DECIMAL(12,2) NULL,
  ADD COLUMN profile_price DECIMAL(12,2) NULL AFTER account_price;
