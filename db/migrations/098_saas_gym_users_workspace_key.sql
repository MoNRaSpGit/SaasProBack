-- Cada usuario del gym apunta a un workspace. Los existentes (ale,
-- invitado) quedan en 'public' (el de siempre); un usuario demo nuevo
-- puede tener el suyo propio, vacio.
ALTER TABLE saas_gym_users
  ADD COLUMN workspace_key VARCHAR(40) NOT NULL DEFAULT 'public' AFTER full_name;
