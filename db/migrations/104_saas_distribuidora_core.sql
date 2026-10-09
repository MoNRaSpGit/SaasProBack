CREATE TABLE IF NOT EXISTS saas_distribuidora_clients (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  rut VARCHAR(20) NULL,
  address VARCHAR(200) NULL,
  phone VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_distribuidora_clients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_distribuidora_products (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_distribuidora_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- client_name/client_rut/client_address e items son una FOTO del momento
-- del pedido: la boleta tiene que seguir diciendo lo mismo aunque despues
-- se edite el cliente o cambie el precio de un producto.
CREATE TABLE IF NOT EXISTS saas_distribuidora_orders (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  client_name VARCHAR(160) NOT NULL,
  client_rut VARCHAR(20) NULL,
  client_address VARCHAR(200) NULL,
  items JSON NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  note VARCHAR(300) NULL,
  status ENUM('pendiente','facturado') NOT NULL DEFAULT 'pendiente',
  invoice_number INT NULL,
  invoiced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_distribuidora_orders_invoice (invoice_number),
  KEY idx_distribuidora_orders_status (status, created_at),
  CONSTRAINT fk_distribuidora_order_client FOREIGN KEY (client_id) REFERENCES saas_distribuidora_clients (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
