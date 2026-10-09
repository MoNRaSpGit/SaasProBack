-- Registro interno de uso de frontend-construccion (09/10/2026): quien
-- entro y que toco. No hay login, asi que "quien" es un id que el
-- navegador genera solo la primera vez (visitor_id). occurred_at en UTC.
CREATE TABLE IF NOT EXISTS saas_construccion_activity_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(40) NOT NULL,
  event ENUM('entrada', 'seccion', 'accion') NOT NULL,
  detail VARCHAR(200) NULL,
  user_agent VARCHAR(255) NULL,
  occurred_at DATETIME NOT NULL,
  KEY idx_construccion_activity_occurred (occurred_at),
  KEY idx_construccion_activity_visitor (visitor_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
