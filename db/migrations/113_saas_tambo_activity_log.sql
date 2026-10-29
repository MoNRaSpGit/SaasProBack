-- Registro interno de uso de frontend-tambo (29/10/2026): quien entro y que
-- hizo. El ingreso es un boton "Ingresar" sin contraseña; role dice si
-- entro el cliente (boton) o nosotros (5 toques al logo de Logic Lab).
-- visitor_id lo genera el navegador la primera vez. occurred_at en UTC.
CREATE TABLE IF NOT EXISTS saas_tambo_activity_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(40) NOT NULL,
  role ENUM('cliente', 'logiclab') NOT NULL,
  event ENUM('login', 'logout', 'seccion', 'accion') NOT NULL,
  detail VARCHAR(200) NULL,
  user_agent VARCHAR(255) NULL,
  occurred_at DATETIME NOT NULL,
  KEY idx_tambo_activity_occurred (occurred_at),
  KEY idx_tambo_activity_visitor (visitor_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
