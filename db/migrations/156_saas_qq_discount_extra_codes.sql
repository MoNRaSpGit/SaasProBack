-- QQ (23/11/2026): codigos de descuento extra (hasta 4 mas, 5 en total con el
-- principal) para saber quien vendio: cada vendedor tiene su codigo y sale en el
-- WhatsApp. Se guardan como JSON en la misma fila unica de la config.
ALTER TABLE saas_qq_discount_config ADD COLUMN extra_codes TEXT NULL;
