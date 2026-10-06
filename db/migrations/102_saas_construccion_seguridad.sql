CREATE TABLE IF NOT EXISTS saas_construccion_seguridad (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  personal_id INT NOT NULL,
  fecha DATE NOT NULL,
  cumple TINYINT(1) NOT NULL DEFAULT 1,
  items_faltantes JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_construccion_seguridad (personal_id, fecha),
  CONSTRAINT fk_construccion_seguridad_personal FOREIGN KEY (personal_id) REFERENCES saas_construccion_personal (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
