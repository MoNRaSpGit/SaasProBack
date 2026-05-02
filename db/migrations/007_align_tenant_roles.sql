UPDATE saas_tenant_memberships
SET role = 'admin'
WHERE role = 'owner';

ALTER TABLE saas_tenant_memberships
MODIFY COLUMN role ENUM('admin', 'operario', 'staff') NOT NULL DEFAULT 'admin';
