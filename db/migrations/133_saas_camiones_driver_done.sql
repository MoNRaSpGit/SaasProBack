-- El camionero avisa "termine el viaje" (15/11/2026): NULL = todavia no.
-- Flujo: enviado -> aprobado (admin pone km/valor) -> terminado (camionero) -> pagado (admin).
ALTER TABLE saas_camiones_trips
  ADD COLUMN driver_done_at DATETIME NULL AFTER driver_paid_at;
