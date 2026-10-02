-- Pedido explicito (02/10/2026): "primero seleccionamos el peluquero...
-- despues va al turno de ese peluquero" -- cada peluquero tiene su propia
-- agenda independiente, asi que la clave unica pasa a ser
-- (peluquero, fecha, hora) en vez de (fecha, hora) sola: el mismo horario
-- puede estar libre para uno y ocupado para otro.
ALTER TABLE saas_peluqueria_reservations
  ADD COLUMN peluquero VARCHAR(60) NOT NULL DEFAULT '' AFTER id,
  DROP INDEX uq_peluqueria_slot,
  ADD UNIQUE KEY uq_peluqueria_slot (peluquero, reservation_date, reservation_time);
