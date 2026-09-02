-- Chat interno basico entre los roles Administrador y Usuario de Joker.
-- Un solo canal compartido (no hay cuentas individuales, el login es por
-- rol) -- sender_role identifica quien mando cada mensaje.
CREATE TABLE IF NOT EXISTS saas_joker_chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_role ENUM('administrador', 'usuario') NOT NULL,
  message VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_chat_messages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
