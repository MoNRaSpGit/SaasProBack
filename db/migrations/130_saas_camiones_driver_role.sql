-- Rol "camionero" (14/11/2026): usuarios que solo cargan viajes (camion,
-- zorra, cliente, origen y destino) sin ver ni poner valores. Aditiva: solo
-- agrega un valor al ENUM, los roles existentes no cambian.
ALTER TABLE saas_tenant_memberships
  MODIFY COLUMN role ENUM('admin', 'operario', 'staff', 'camionero') NOT NULL DEFAULT 'admin';
