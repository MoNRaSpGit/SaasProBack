-- Web de Logic Lab (27/11/2026): eventos del recorrido (video entero, seccion
-- vista, boton tocado). Solo agrega valores al final del ENUM.
ALTER TABLE saas_logiclab_events
  MODIFY event ENUM('visit', 'ver_video', 'wa_click', 'cotizador_abrir', 'cotizador_enviar', 'video_completo', 'ver_seccion', 'clic') NOT NULL;
