-- Pantalla de ingreso sin contraseña en frontend-construccion (09/10/2026):
-- el registro de uso pasa a anotar inicio y cierre de sesion.
ALTER TABLE saas_construccion_activity_log
  MODIFY event ENUM('entrada', 'seccion', 'accion', 'login', 'logout') NOT NULL;
