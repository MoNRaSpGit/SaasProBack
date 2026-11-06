-- Camion que hizo el viaje (06/11/2026). NULL = viaje viejo sin asignar.
ALTER TABLE saas_camiones_trips
  ADD COLUMN truck ENUM('mercedes', 'honda') NULL AFTER place;
