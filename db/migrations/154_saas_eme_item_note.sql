-- Nota por producto del pedido (20/11/2026): "bien cocida", "que la muzza no
-- se derrita"... Opcional, distinta de la nota general del pedido.
ALTER TABLE saas_eme_order_items ADD COLUMN note VARCHAR(160) NULL;
