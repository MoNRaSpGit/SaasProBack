-- Caja (20/11/2026): marca si ya se cargo la caja inicial del turno (aunque sea
-- $0 con "Seguir sin caja"). Si no, al ingresar un pedido la app la pide.
ALTER TABLE saas_eme_register_sessions ADD COLUMN opening_set TINYINT(1) NOT NULL DEFAULT 0;
