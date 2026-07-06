ALTER TABLE saasPro_users
  ADD COLUMN last_login_at DATETIME NULL AFTER updated_at;
