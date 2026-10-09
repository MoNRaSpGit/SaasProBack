-- Auditoria interna de frontend-distribuidora (09/10/2026): que se hizo,
-- cuando y desde que dispositivo. before_json / after_json guardan la
-- foto completa -- en un borrado, before_json es la unica copia que
-- queda del pedido o la boleta. occurred_at en UTC.
CREATE TABLE IF NOT EXISTS saas_distribuidora_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME NOT NULL,
  action VARCHAR(30) NOT NULL,
  entity_id INT NOT NULL,
  summary VARCHAR(255) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  device_id VARCHAR(40) NULL,
  user_agent VARCHAR(255) NULL,
  KEY idx_distribuidora_audit_occurred (occurred_at),
  KEY idx_distribuidora_audit_entity (action, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
