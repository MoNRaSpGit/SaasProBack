-- Login propio de frontend-qq (14/09/2026): registrarse/ingresar, con dos
-- roles -- "administrador" (carga/edita/borra productos) y "usuario"
-- (solo mira el catalogo). A proposito NO usa el sistema grande de
-- tenants/membresias del resto de la plataforma (eso es para dar de alta
-- CLIENTES nuevos de SaasPro) -- esto es el login de los propios
-- visitantes/clientes del catalogo de un unico cliente (frontend-qq), un
-- caso bien distinto.
CREATE TABLE IF NOT EXISTS saas_qq_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(191) NOT NULL,
  full_name VARCHAR(120) NULL,
  role ENUM('administrador', 'usuario') NOT NULL DEFAULT 'usuario',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_qq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sesiones simples por token opaco (no JWT) -- alcanza para esta escala y
-- evita duplicar logica de firmar/verificar tokens del sistema grande.
CREATE TABLE IF NOT EXISTS saas_qq_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_qq_sessions_token (token),
  KEY idx_saas_qq_sessions_user (user_id),
  CONSTRAINT fk_saas_qq_sessions_user FOREIGN KEY (user_id) REFERENCES saas_qq_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
