-- Registro de auditoria de frontend-piloto (22/09/2026, pedido explicito:
-- "hacerle auditoria al igual que tenemos en los otros proyectos, para
-- saber bien y con exactitud los movimientos"). Mismo criterio que
-- saas_qq_audit_log (ver db/migrations/089): PARA NOSOTROS, no hay
-- pantalla en la app que lo muestre, se consulta con
-- scripts/inspect-piloto-audit.js.
--
-- Piloto no tiene login/roles (es un solo operador con el POS), asi que
-- actor_email/actor_role quedan siempre NULL -- se dejan igual que en qq
-- por si el dia de mañana se agrega un login.
--
-- occurred_at se guarda en UTC explicito (lo arma Node con toISOString, no
-- CURRENT_TIMESTAMP) para no depender del timezone del servidor de MySQL
-- (mismo bug de +3hs que ya se encontro antes, ver
-- scripts/check-oriol-activity.js).
CREATE TABLE IF NOT EXISTS saas_piloto_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME NOT NULL,
  action VARCHAR(30) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(40) NULL,
  entity_label VARCHAR(255) NULL,
  actor_email VARCHAR(200) NULL,
  actor_role VARCHAR(20) NULL,
  details TEXT NULL,
  KEY idx_saas_piloto_audit_occurred (occurred_at),
  KEY idx_saas_piloto_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
