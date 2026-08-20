-- Agrega apellido (obligatorio), telefono (opcional) y foto (opcional,
-- guardada como data URI base64) al jugador. La tabla en si se crea sola
-- desde JuezPlayersService.createTables() (no tenia migracion propia
-- todavia) -- esta migracion es para la base que ya existe en produccion
-- con datos reales, donde el CREATE TABLE IF NOT EXISTS del service no
-- alcanza para agregar columnas nuevas a una tabla que ya existe.

ALTER TABLE saas_juez_players
  ADD COLUMN last_name VARCHAR(120) NOT NULL DEFAULT '' AFTER name,
  ADD COLUMN phone VARCHAR(30) NULL AFTER cedula,
  ADD COLUMN photo_data_url LONGTEXT NULL AFTER birth_date;
