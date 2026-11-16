-- WhatsApp por cliente de Scrum (16/11/2026): opcional. Si esta cargado se
-- habilitan los botones de aviso (recordatorio, retraso) y recibo para ese
-- cliente; guardado como digitos con prefijo de pais (ej: 59899123456).
ALTER TABLE saas_scrum_clients
  ADD COLUMN whatsapp VARCHAR(20) NULL DEFAULT NULL;
