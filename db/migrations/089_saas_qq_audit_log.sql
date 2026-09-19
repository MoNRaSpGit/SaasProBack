-- Registro de auditoria de frontend-qq (19/09/2026): quien hizo que y cuando
-- (producto nuevo/editado/borrado/reordenado, foto de producto, imagenes del
-- carrusel, clientes de cuenta corriente, altas y logins). PARA NOSOTROS --
-- no hay pantalla en la app que lo muestre, se consulta con
-- scripts/inspect-qq-audit.js (mismo criterio que el auditLog de agro).
--
-- occurred_at se guarda en UTC explicito (lo arma Node con toISOString, no
-- CURRENT_TIMESTAMP) para no depender del timezone del servidor de MySQL.
-- details es JSON en texto: para editar guarda { changes: { campo: [antes,
-- despues] } }. NUNCA guarda binarios de imagen ni contrasenas.
CREATE TABLE IF NOT EXISTS saas_qq_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME NOT NULL,
  action VARCHAR(30) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(40) NULL,
  entity_label VARCHAR(255) NULL,
  actor_email VARCHAR(200) NULL,
  actor_role VARCHAR(20) NULL,
  details TEXT NULL,
  KEY idx_saas_qq_audit_occurred (occurred_at),
  KEY idx_saas_qq_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
