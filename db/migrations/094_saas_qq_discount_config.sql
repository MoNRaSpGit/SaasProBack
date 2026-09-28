-- Codigo de descuento configurable por el admin de frontend-qq (28/09/2026,
-- pedido explicito): un solo codigo activo a la vez, con su porcentaje
-- (entero 1-10) y si esta habilitado o no. Fila unica (id siempre 1) --
-- el admin la actualiza, nunca se insertan filas nuevas.
CREATE TABLE IF NOT EXISTS saas_qq_discount_config (
  id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  code VARCHAR(40) NOT NULL DEFAULT '',
  percentage TINYINT NOT NULL DEFAULT 10,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO saas_qq_discount_config (id, code, percentage, enabled) VALUES (1, '', 10, 0);
