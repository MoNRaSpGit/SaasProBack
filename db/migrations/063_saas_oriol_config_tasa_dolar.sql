-- Persiste la tasa de conversion dolar->pesos (antes era una constante fija
-- en el codigo, TASA_DOLAR = 40) para poder editarla desde el Panel sin
-- necesitar un deploy. Sigue usandose solo para calculos en pesos del
-- Panel (caja del dia, ganancia) -- la deuda de clientes ya no la usa, ver
-- 062_saas_oriol_deuda_dolares.sql.

ALTER TABLE saas_oriol_config
  ADD COLUMN tasa_dolar DECIMAL(10,2) NOT NULL DEFAULT '40.00' AFTER cambio;
