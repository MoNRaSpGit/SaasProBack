ALTER TABLE saas_alamcen_products
  ADD KEY idx_saas_alamcen_products_tenant_barcode (tenant_id, barcode);
