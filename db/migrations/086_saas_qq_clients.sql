-- Cuenta corriente de clientes de frontend-qq (15/09/2026): el admin
-- carga clientes con fecha de vencimiento y el frontend los pinta en
-- blanco/amarillo/rojo segun cuanto falte para esa fecha. Datos con
-- email/telefono -- SOLO el admin puede ver/tocar esta tabla (a
-- diferencia de productos/carrusel, que son publicos).
CREATE TABLE IF NOT EXISTS saas_qq_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NULL,
  phone VARCHAR(50) NULL,
  due_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
