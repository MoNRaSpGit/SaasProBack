-- Permite que un slot de combo resuelva sus opciones EN VIVO por categoria
-- (cualquier producto publicado de esa categoria entra solo, sin tocar
-- nada cuando se agrega uno nuevo) en vez de una lista fija de ids --
-- pensado para los refrescos de los combos, que antes habia que sumar a
-- mano en seed-joker-combo-slots.js cada vez que entraba una soda nueva.
-- NULL (el default, y el valor de todo lo que ya existe) mantiene el
-- comportamiento de lista fija de option_product_ids -- para slots
-- curados a mano que no son "toda la categoria" (ej: las hamburguesas de
-- cada combo).
ALTER TABLE saas_joker_combo_slots
  ADD COLUMN option_category VARCHAR(255) NULL DEFAULT NULL;
