-- Registro interno de uso de Eme (12/11/2026): quien entro y que hizo,
-- para saber si la estan usando (se ve en la app de Movimientos). No hay
-- login: "quien" es un id que el navegador genera solo (visitor_id); los
-- que empiezan con "yo-" son dispositivos NUESTROS. occurred_at en UTC.
CREATE TABLE IF NOT EXISTS saas_eme_activity_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(40) NOT NULL,
  event VARCHAR(20) NOT NULL,
  detail VARCHAR(200) NULL,
  user_agent VARCHAR(255) NULL,
  occurred_at DATETIME NOT NULL,
  KEY idx_eme_activity_occurred (occurred_at),
  KEY idx_eme_activity_visitor (visitor_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
