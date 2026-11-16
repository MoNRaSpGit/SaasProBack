-- Auditoria de Camiones (16/11/2026): quien aprobo un viaje, cambio su valor,
-- lo reasigno, lo edito o lo borro, y cuando. Solo AGREGA una tabla.
CREATE TABLE IF NOT EXISTS saas_camiones_audit_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED NOT NULL,
  actor_user_id INT UNSIGNED NULL,
  actor_name VARCHAR(160) NULL,
  action VARCHAR(30) NOT NULL,
  trip_id INT UNSIGNED NULL,
  summary VARCHAR(255) NOT NULL,
  details_json TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_camiones_audit_day (tenant_id, created_at),
  KEY idx_camiones_audit_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
