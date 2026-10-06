CREATE TABLE IF NOT EXISTS saas_construccion_obras (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  direccion VARCHAR(200) NOT NULL DEFAULT '',
  activa TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_construccion_personal (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  cargo VARCHAR(40) NOT NULL,
  telefono VARCHAR(40) NOT NULL DEFAULT '',
  obra_id INT NULL,
  jornal DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_ingreso DATE NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_construccion_personal_obra FOREIGN KEY (obra_id) REFERENCES saas_construccion_obras (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_construccion_asistencias (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  personal_id INT NOT NULL,
  fecha DATE NOT NULL,
  estado ENUM('presente', 'media', 'ausente') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_construccion_asistencia (personal_id, fecha),
  CONSTRAINT fk_construccion_asistencia_personal FOREIGN KEY (personal_id) REFERENCES saas_construccion_personal (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_construccion_anticipos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  personal_id INT NOT NULL,
  fecha DATE NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  nota VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_construccion_anticipo_personal FOREIGN KEY (personal_id) REFERENCES saas_construccion_personal (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
