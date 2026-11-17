-- Suscripciones a notificaciones push del dueño de la peluqueria (17/11/2026).
-- Cada celular que toca "Activar avisos" deja una fila; endpoint_hash evita
-- duplicados (el endpoint es una URL larga, se indexa por su sha256).
CREATE TABLE IF NOT EXISTS saas_peluqueria_push_subscriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  endpoint_hash CHAR(64) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peluqueria_push_endpoint (endpoint_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
