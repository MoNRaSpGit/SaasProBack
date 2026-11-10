-- 09/11/2026: paso 2. Con el backend y el frontend ya desplegados con
-- 'volkswagen', los viajes viejos de 'honda' pasan a 'volkswagen' y se saca
-- 'honda' del ENUM.
UPDATE saas_camiones_trips SET truck = 'volkswagen' WHERE truck = 'honda';
ALTER TABLE saas_camiones_trips
  MODIFY COLUMN truck ENUM('mercedes', 'volkswagen') NULL;
