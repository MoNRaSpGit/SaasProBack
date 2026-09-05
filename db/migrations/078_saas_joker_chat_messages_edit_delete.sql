-- Editar/eliminar mensaje del chat interno, igual que WhatsApp: edited_at
-- marca que el texto ya no es el original (el frontend muestra "editado"),
-- deleted_at es un borrado logico -- el mensaje no se saca de la tabla,
-- pero el frontend lo muestra como "Mensaje eliminado" en vez del texto.
ALTER TABLE saas_joker_chat_messages
  ADD COLUMN edited_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
