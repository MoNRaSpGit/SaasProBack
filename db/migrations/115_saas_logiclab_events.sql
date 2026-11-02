-- Contador propio de visitas de frontend-logiclab (02/11/2026, pedido
-- explicito: reemplazar GoatCounter, "no quiere cuentas externas, quiere
-- los datos en su base"). visitor_hash es un hash con sal de la IP, nunca
-- la IP tal cual -- solo para aproximar visitantes unicos por dia.
-- occurred_at en UTC.
CREATE TABLE IF NOT EXISTS saas_logiclab_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME NOT NULL,
  event ENUM('visit', 'ver_video', 'wa_click', 'cotizador_abrir', 'cotizador_enviar') NOT NULL,
  rubro VARCHAR(30) NULL,
  section VARCHAR(30) NULL,
  plan VARCHAR(30) NULL,
  src VARCHAR(30) NULL,
  visitor_id VARCHAR(40) NOT NULL,
  visitor_hash VARCHAR(64) NOT NULL,
  KEY idx_logiclab_events_occurred (occurred_at),
  KEY idx_logiclab_events_visitor (visitor_hash, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
