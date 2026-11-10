-- 09/11/2026: el segundo camion no es Honda, es Volkswagen. Paso 1 (aditivo):
-- se agrega 'volkswagen' al ENUM sin sacar 'honda', asi nada se rompe mientras
-- se despliega el backend nuevo. El paso 2 es la migracion 123.
ALTER TABLE saas_camiones_trips
  MODIFY COLUMN truck ENUM('mercedes', 'honda', 'volkswagen') NULL;
