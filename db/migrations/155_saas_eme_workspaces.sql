-- EME (21/11/2026): espacios separados por usuario. workspace_id = id del usuario
-- (saas_eme_users). Todo lo que ya existia es de "nueva" (id 2), por eso el
-- DEFAULT 2: asi el servidor viejo sigue andando mientras se despliega el nuevo.
-- Pedidos, caja, clientes y repartidores se separan; el menu (categorias y
-- productos) tambien, y "admin" arranca con una copia (script apply-155).
-- Los productos y categorias NO se borran nunca (triggers): esto solo agrega columnas.

ALTER TABLE saas_eme_meta ADD COLUMN workspace_id INT UNSIGNED NOT NULL DEFAULT 2;
UPDATE saas_eme_meta SET workspace_id = 2 WHERE id = 1;
ALTER TABLE saas_eme_meta ADD UNIQUE KEY uq_eme_meta_workspace (workspace_id);

ALTER TABLE saas_eme_categories ADD COLUMN workspace_id INT UNSIGNED NOT NULL DEFAULT 2;
ALTER TABLE saas_eme_categories DROP INDEX uq_eme_category_name, ADD UNIQUE KEY uq_eme_category_name (workspace_id, name);

ALTER TABLE saas_eme_products ADD COLUMN workspace_id INT UNSIGNED NOT NULL DEFAULT 2;
ALTER TABLE saas_eme_couriers ADD COLUMN workspace_id INT UNSIGNED NOT NULL DEFAULT 2;
ALTER TABLE saas_eme_clients ADD COLUMN workspace_id INT UNSIGNED NOT NULL DEFAULT 2;

ALTER TABLE saas_eme_orders ADD COLUMN workspace_id INT UNSIGNED NOT NULL DEFAULT 2;
ALTER TABLE saas_eme_orders DROP INDEX uq_eme_order_number, ADD UNIQUE KEY uq_eme_order_number (workspace_id, number);

ALTER TABLE saas_eme_register_sessions ADD COLUMN workspace_id INT UNSIGNED NOT NULL DEFAULT 2;
