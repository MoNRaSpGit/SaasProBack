-- Avisos de demora (11/11/2026): desde Scrum (Clientes) se activa un cartel
-- "su servicio se encuentra vencido" para el usuario de la app del cliente.
-- Un cliente de Scrum <-> un usuario de una app (hoy solo gym). El servicio
-- (NoticesService) tambien crea la tabla sola si falta.
CREATE TABLE IF NOT EXISTS saas_service_notices (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    scrum_client_id INT UNSIGNED NOT NULL,
    app_key VARCHAR(30) NOT NULL,
    app_username VARCHAR(80) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 0,
    activated_at DATETIME NULL,
    last_seen_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_service_notices_client (scrum_client_id),
    KEY idx_service_notices_app_user (app_key, app_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
