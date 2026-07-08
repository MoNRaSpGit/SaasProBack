ALTER TABLE saas_alamcen_dashboard_daily
  ADD COLUMN sales_total DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER initial_cash;

UPDATE saas_alamcen_dashboard_daily
SET sales_total = 0
WHERE sales_total IS NULL;

INSERT INTO saas_alamcen_dashboard_daily (tenant_id, business_date, initial_cash, sales_total)
SELECT
  tenant_id,
  DATE(DATE_SUB(created_at, INTERVAL 3 HOUR)) AS business_date,
  0 AS initial_cash,
  SUM(total_amount) AS sales_total
FROM saas_alamcen_sales
WHERE status = 'confirmed'
GROUP BY tenant_id, DATE(DATE_SUB(created_at, INTERVAL 3 HOUR))
ON DUPLICATE KEY UPDATE
  sales_total = VALUES(sales_total);

ALTER TABLE saas_alamcen_sales
  ADD KEY idx_saas_alamcen_sales_tenant_status_created (tenant_id, status, created_at);

ALTER TABLE saas_alamcen_payments
  ADD KEY idx_saas_alamcen_payments_tenant_status_created (tenant_id, status, created_at);

ALTER TABLE saas_alamcen_sale_items
  ADD KEY idx_saas_alamcen_sale_items_tenant_sale (tenant_id, sale_id);
