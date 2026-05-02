ALTER TABLE saas_tenant_settings
ADD COLUMN billing_status ENUM('active', 'grace_period', 'pending_manual_block', 'blocked') NOT NULL DEFAULT 'active' AFTER logo_url,
ADD COLUMN paid_until DATE NULL AFTER billing_status,
ADD COLUMN grace_until DATE NULL AFTER paid_until,
ADD COLUMN blocked_reason VARCHAR(255) NULL AFTER grace_until;
