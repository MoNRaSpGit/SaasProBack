-- Documenta el esquema real de las tablas de oriol (ya existian con datos
-- reales, migradas desde oriolnuevo_* -- ver el rename hecho durante la
-- limpieza de tablas huerfanas). CREATE TABLE IF NOT EXISTS: no pisa nada
-- si ya existen, pero deja el modulo reproducible en una base nueva.

CREATE TABLE IF NOT EXISTS saas_oriol_clientes (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(40) NULL,
  deuda DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cedula VARCHAR(20) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_oriol_prodcutos (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NULL DEFAULT '0.00',
  image LONGTEXT NULL,
  description TEXT NULL,
  currency VARCHAR(5) NULL DEFAULT 'UYU',
  codigo_barra VARCHAR(50) NULL,
  stock INT NOT NULL DEFAULT '0',
  stock_minimo INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY codigo_barra (codigo_barra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_oriol_ventas (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_id INT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_pesos DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  total_dolares DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  detalle TEXT NULL,
  metodo_pago ENUM('efectivo', 'tarjeta', 'credito') NOT NULL DEFAULT 'credito',
  PRIMARY KEY (id),
  KEY cliente_id (cliente_id),
  CONSTRAINT saas_oriol_ventas_ibfk_1 FOREIGN KEY (cliente_id) REFERENCES saas_oriol_clientes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_oriol_pagos (
  id INT NOT NULL AUTO_INCREMENT,
  valor DECIMAL(10,2) NOT NULL,
  detalle VARCHAR(255) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Singleton (id=1): "cambio" es la caja inicial del dia, se actualiza con
-- INSERT ... ON DUPLICATE KEY UPDATE (ver OriolService.updateCambio).
CREATE TABLE IF NOT EXISTS saas_oriol_config (
  id INT NOT NULL,
  cambio DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
