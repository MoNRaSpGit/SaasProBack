-- Clientes reales de la distribuidora (09/10/2026), cargados desde la
-- planilla del sistema anterior. code = codigo de esa planilla (unico,
-- permite recargarla sin duplicar; null en los dados de alta desde la
-- app). contact_name = la persona, cuando el negocio tiene otro nombre.
-- seller_code / route / latitude / longitude vienen de la planilla y
-- todavia no se usan en la app: quedan para repartir clientes por
-- vendedor, armar recorridos o mostrar un mapa.
ALTER TABLE saas_distribuidora_clients
  ADD COLUMN code VARCHAR(60) NULL AFTER id,
  ADD COLUMN contact_name VARCHAR(160) NULL AFTER name,
  ADD COLUMN seller_code VARCHAR(20) NULL,
  ADD COLUMN route VARCHAR(10) NULL,
  ADD COLUMN latitude DECIMAL(10,7) NULL,
  ADD COLUMN longitude DECIMAL(10,7) NULL,
  ADD UNIQUE KEY uq_distribuidora_clients_code (code),
  ADD KEY idx_distribuidora_clients_seller (seller_code);
