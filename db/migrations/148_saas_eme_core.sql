-- EME (restaurante) en tablas propias (18/11/2026). Hasta hoy todo vivia en un
-- unico JSON (saas_eme_demo_state) que se mandaba completo en cada cambio. Ahora:
-- categorias, productos (con ingredientes), repartidores, clientes de cuenta
-- corriente (con sus pagos) y pedidos (con sus renglones y modificaciones).
-- El saldo de un cliente NO se guarda: se calcula (pedidos en cuenta corriente
-- menos pagos), asi nunca se desincroniza.

CREATE TABLE IF NOT EXISTS saas_eme_meta (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  -- Sube en cada cambio: los dispositivos consultan "cambio algo desde la version N?".
  version INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_eme_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_products (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  emoji VARCHAR(16) NOT NULL DEFAULT '🍽',
  position INT UNSIGNED NOT NULL DEFAULT 0,
  -- Borrar un producto lo desactiva: los pedidos viejos conservan su historia.
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_eme_product_category (category_id, position),
  CONSTRAINT fk_eme_product_category FOREIGN KEY (category_id) REFERENCES saas_eme_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_product_ingredients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(40) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  name VARCHAR(80) NOT NULL,
  KEY idx_eme_ingredient_product (product_id, position),
  CONSTRAINT fk_eme_ingredient_product FOREIGN KEY (product_id) REFERENCES saas_eme_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_couriers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_clients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  address VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_eme_client_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_client_payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_eme_payment_client (client_id, paid_at),
  CONSTRAINT fk_eme_payment_client FOREIGN KEY (client_id) REFERENCES saas_eme_clients (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_orders (
  id VARCHAR(30) NOT NULL PRIMARY KEY,
  number INT UNSIGNED NOT NULL,
  channel ENUM('mesa','mostrador','whatsapp') NOT NULL,
  kind ENUM('salon','delivery','retiro') NOT NULL,
  status ENUM('por_aceptar','aceptado','en_camino','entregado','rechazado') NOT NULL,
  table_no INT UNSIGNED NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  client_name VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  address VARCHAR(200) NOT NULL DEFAULT '',
  payment ENUM('efectivo','tarjeta','cuenta') NOT NULL DEFAULT 'efectivo',
  client_id INT UNSIGNED NULL,
  courier_id INT UNSIGNED NULL,
  total DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Fechas en UTC (se muestran en hora de Montevideo en la app).
  created_at DATETIME NOT NULL,
  delivered_at DATETIME NULL,
  UNIQUE KEY uq_eme_order_number (number),
  KEY idx_eme_order_created (created_at),
  KEY idx_eme_order_status (status),
  KEY idx_eme_order_client (client_id),
  CONSTRAINT fk_eme_order_client FOREIGN KEY (client_id) REFERENCES saas_eme_clients (id),
  CONSTRAINT fk_eme_order_courier FOREIGN KEY (courier_id) REFERENCES saas_eme_couriers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(30) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  product_id VARCHAR(40) NULL,
  -- name = como se ve en el ticket (con extras y "sin"); base_name = el producto solo.
  name VARCHAR(255) NOT NULL,
  base_name VARCHAR(120) NULL,
  price DECIMAL(10,2) NOT NULL,
  qty INT UNSIGNED NOT NULL,
  KEY idx_eme_item_order (order_id, position),
  CONSTRAINT fk_eme_item_order FOREIGN KEY (order_id) REFERENCES saas_eme_orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_eme_item_product FOREIGN KEY (product_id) REFERENCES saas_eme_products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_order_item_mods (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  kind ENUM('extra','removed') NOT NULL,
  label VARCHAR(80) NOT NULL,
  KEY idx_eme_mod_item (item_id),
  CONSTRAINT fk_eme_mod_item FOREIGN KEY (item_id) REFERENCES saas_eme_order_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
