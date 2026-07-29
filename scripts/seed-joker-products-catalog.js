// Carga del catalogo real de El Joker (~200 productos), relevado en 10
// bloques con el cliente. Reemplaza los productos demo cargados en la
// migracion 026. Ver notas de la sesion para el detalle de cada decision
// de modelado (variantes aplanadas, extras, combos, etc.).
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// p: name, c: category, sc: subcategory, scd: subcategory_detail,
// br: brand, pr: price, ing: ingredients, obs: observations,
// pt: product_type ('simple'|'extra'), st: status ('draft'|'published'),
// pu: pricing_unit ('unidad'|'kg')
function product(p) {
  return {
    name: p.p,
    category: p.c,
    subcategory: p.sc || null,
    subcategoryDetail: p.scd || null,
    brand: p.br || null,
    price: p.pr,
    ingredients: p.ing || null,
    observations: p.obs || null,
    productType: p.pt || "simple",
    status: p.st || "published",
    pricingUnit: p.pu || "unidad"
  };
}

const PRODUCTS = [
  // ===== BLOQUE 1: Pizza =====
  product({ p: "Pizza XIS con pollo BBQ", c: "Pizza", ing: "Pollo, salsa BBQ", pr: 590 }),
  product({ p: "Pizza con Muzzarella (Metro)", c: "Pizza", ing: "Muzzarella", pr: 750 }),
  product({ p: "Pizza con Muzzarella (Medio metro)", c: "Pizza", ing: "Muzzarella", pr: 400 }),
  product({ p: "Pizza con Muzzarella (Cuarto metro)", c: "Pizza", ing: "Muzzarella", pr: 250 }),
  product({ p: "Pizza con Muzzarella (Redonda)", c: "Pizza", ing: "Muzzarella", pr: 450 }),
  product({ p: "Ananá", c: "Pizza", sc: "Extras", pr: 50, pt: "extra" }),
  product({ p: "Aceituna", c: "Pizza", sc: "Extras", pr: 50, pt: "extra" }),
  product({ p: "Huevo", c: "Pizza", sc: "Extras", pr: 50, pt: "extra" }),
  product({ p: "Morrón", c: "Pizza", sc: "Extras", pr: 50, pt: "extra" }),
  product({ p: "Cebolla", c: "Pizza", sc: "Extras", pr: 50, pt: "extra" }),
  product({
    p: "Panceta Ahumada + Jamón",
    c: "Pizza",
    sc: "Extras",
    pr: 100,
    pt: "extra",
    obs: "Se considera un unico sabor combinado."
  }),

  // ===== BLOQUE 1: Hamburguesas =====
  product({
    p: "Hamburguesa Común",
    c: "Hamburguesas",
    sc: "Clásicas",
    ing: "Carne, huevo, granos, lechuga, tomate, aderezos",
    pr: 270
  }),
  product({
    p: "Hamburguesa Especial",
    c: "Hamburguesas",
    sc: "Clásicas",
    ing: "Carne, huevo, granos, lechuga, tomate, aderezo, jamón, panceta, muzzarella",
    pr: 330
  }),
  product({
    p: "Hamburguesa Americana BBQ",
    c: "Hamburguesas",
    sc: "Clásicas",
    ing: "Carne, huevo, muzzarella, panceta, cebolla caramelizada, salsa BBQ, mayonesa",
    pr: 320
  }),
  product({
    p: "Hamburguesa 4Q",
    c: "Hamburguesas",
    sc: "Clásicas",
    ing: "Carne, huevo, salsa 4Q, mayonesa, ketchup, panceta, cebolla morada",
    pr: 310
  }),
  product({
    p: "Hamburguesa XIS de Pollo",
    c: "Hamburguesas",
    sc: "Clásicas",
    ing: "Pollo, huevo, granos, lechuga, tomate, panceta, jamón, muzzarella, aderezo",
    pr: 320
  }),
  product({
    p: "Hamburguesa Especial Doble Carne",
    c: "Hamburguesas",
    sc: "Doble Carne",
    ing: "Doble carne, huevo, granos, lechuga, tomate, aderezos, jamón, panceta, muzzarella",
    pr: 420
  }),
  product({
    p: "Hamburguesa Americana BBQ 2.0",
    c: "Hamburguesas",
    sc: "Doble Carne",
    ing: "Doble carne, huevo, muzzarella, panceta, cebolla caramelizada, salsa BBQ, mayonesa",
    pr: 410
  }),
  product({
    p: "Hamburguesa 4Q 2.0",
    c: "Hamburguesas",
    sc: "Doble Carne",
    ing: "Doble carne, doble huevo, salsa 4Q, mayonesa, ketchup, panceta, cebolla morada, muzzarella, cheddar",
    pr: 400
  }),

  // ===== BLOQUE 1: Panchos =====
  product({ p: "Pancho Común", c: "Panchos", sc: "Panchos", ing: "Pancho Centenario, aderezos, papitas", pr: 120 }),
  product({
    p: "Pancho con Muzzarella",
    c: "Panchos",
    sc: "Panchos",
    ing: "Pancho Centenario, aderezos, papitas, muzzarella",
    pr: 160
  }),
  product({
    p: "Pancho con Muzzarella y Panceta",
    c: "Panchos",
    sc: "Panchos",
    ing: "Pancho Centenario, aderezos, papitas, muzzarella, panceta",
    pr: 200
  }),
  product({
    p: "Chori al Pan",
    c: "Panchos",
    sc: "Choripán",
    ing: "Pan, chorizo Centenario, aderezos, salsa criolla, muzzarella",
    pr: 200
  }),

  // ===== BLOQUE 2: Chivitos =====
  product({
    p: "Chivito al Pan",
    c: "Chivitos",
    ing: "Pan, churrasco de lomo, lechuga, tomate, huevo, jamón, panceta, muzzarella",
    pr: 470
  }),
  product({
    p: "Chivito al Plato (Para 1 persona)",
    c: "Chivitos",
    sc: "Plato",
    ing: "Churrasco de lomo, jamón, panceta, muzzarella, huevo frito, ensalada mixta, papas fritas",
    pr: 650
  }),
  product({
    p: "Chivito al Plato (Para 2 personas)",
    c: "Chivitos",
    sc: "Plato",
    ing: "2 churrascos de lomo, jamón, panceta, muzzarella, 2 huevos fritos, ensalada mixta, papas fritas",
    pr: 990
  }),

  // ===== BLOQUE 2: Sándwiches =====
  product({ p: "Caliente Común", c: "Sándwiches", ing: "Pan, manteca, muzzarella, jamón", pr: 320 }),
  product({
    p: "Caliente con Muzzarella",
    c: "Sándwiches",
    ing: "Pan, manteca, muzzarella, jamón, cobertura de muzzarella",
    pr: 420
  }),
  product({
    p: "Caliente con Muzzarella y Panceta",
    c: "Sándwiches",
    ing: "Pan, manteca, muzzarella, jamón, cobertura de muzzarella, panceta",
    pr: 450
  }),
  product({
    p: "Caliente Italiano",
    c: "Sándwiches",
    ing: "Pan, manteca, muzzarella, panceta, huevo, tomate, aceitunas, cobertura de muzzarella",
    pr: 490
  }),
  product({ p: "Olímpico", c: "Sándwiches", ing: "Pan, jamón, queso, huevo, tomate, lechuga, mayonesa", pr: 350 }),

  // ===== BLOQUE 3: Milanesas de Pollo =====
  product({ p: "Milanesa Sola (Para 1 persona)", c: "Milanesas de Pollo", pr: 350 }),
  product({ p: "Milanesa Sola (Para 2 personas)", c: "Milanesas de Pollo", pr: 450 }),
  product({ p: "Milanesa en Dos Panes", c: "Milanesas de Pollo", ing: "Milanesa, pan, papas fritas", pr: 550 }),
  product({
    p: "Milanesa Napolitana con Guarnición (Para 1 persona)",
    c: "Milanesas de Pollo",
    ing: "Milanesa napolitana, guarnición a elección (mixta o fritas)",
    pr: 650
  }),
  product({
    p: "Milanesa Napolitana con Guarnición (Para 2 personas)",
    c: "Milanesas de Pollo",
    ing: "Milanesa napolitana, guarnición a elección (mixta o fritas)",
    pr: 850
  }),
  product({
    p: "Milanesa con Salsa a Elección + Panceta (Para 1 persona)",
    c: "Milanesas de Pollo",
    ing: "Milanesa, salsa a elección, panceta, guarnición (mixta o fritas)",
    pr: 610,
    obs: "Salsas disponibles: 4Q, Champiñones, Cheddar."
  }),
  product({
    p: "Milanesa con Salsa a Elección + Panceta (Para 2 personas)",
    c: "Milanesas de Pollo",
    ing: "Milanesa, salsa a elección, panceta, guarnición (mixta o fritas)",
    pr: 810,
    obs: "Salsas disponibles: 4Q, Champiñones, Cheddar."
  }),

  // ===== BLOQUE 3: Milanesas de Carne =====
  product({ p: "Milanesa Sola (Para 1 persona)", c: "Milanesas de Carne", pr: 450 }),
  product({ p: "Milanesa Sola (Para 2 personas)", c: "Milanesas de Carne", pr: 550 }),
  product({ p: "Milanesa en Dos Panes", c: "Milanesas de Carne", ing: "Milanesa, pan, papas fritas", pr: 650 }),
  product({
    p: "Milanesa Napolitana con Guarnición (Para 1 persona)",
    c: "Milanesas de Carne",
    ing: "Milanesa napolitana, guarnición a elección (mixta o fritas)",
    pr: 750
  }),
  product({
    p: "Milanesa Napolitana con Guarnición (Para 2 personas)",
    c: "Milanesas de Carne",
    ing: "Milanesa napolitana, guarnición a elección (mixta o fritas)",
    pr: 950
  }),
  product({
    p: "Milanesa con Salsa a Elección + Panceta (Para 1 persona)",
    c: "Milanesas de Carne",
    ing: "Milanesa, salsa a elección, panceta, guarnición (mixta o fritas)",
    pr: 710,
    obs: "Salsas disponibles: 4Q, Champiñones, Cheddar."
  }),
  product({
    p: "Milanesa con Salsa a Elección + Panceta (Para 2 personas)",
    c: "Milanesas de Carne",
    ing: "Milanesa, salsa a elección, panceta, guarnición (mixta o fritas)",
    pr: 910,
    obs: "Salsas disponibles: 4Q, Champiñones, Cheddar."
  }),

  // ===== BLOQUE 3: Papas Fritas =====
  product({ p: "Papas Fritas Clásicas (Grande)", c: "Papas Fritas", pr: 200 }),
  product({ p: "Papas Fritas Clásicas (Mediana)", c: "Papas Fritas", pr: 120 }),
  product({ p: "Papas Fritas Clásicas (Mini)", c: "Papas Fritas", pr: 50 }),
  product({ p: "Noisette", c: "Papas Fritas", pr: 240 }),
  product({ p: "Papas Rústicas", c: "Papas Fritas", pr: 280 }),
  product({ p: "Extra Muzzarella + Panceta Ahumada", c: "Papas Fritas", sc: "Extras", pr: 100, pt: "extra" }),
  product({ p: "Salsa Cheddar", c: "Papas Fritas", sc: "Extras", pr: 150, pt: "extra" }),
  product({ p: "Salsa 4Q", c: "Papas Fritas", sc: "Extras", pr: 150, pt: "extra" }),
  product({ p: "Salsa Champiñones", c: "Papas Fritas", sc: "Extras", pr: 150, pt: "extra" }),

  // ===== BLOQUE 4: Tacos (sin precio/ingredientes confirmados aun) =====
  product({ p: "Taco Vegetal", c: "Tacos", pr: 0, st: "draft", obs: "Pendiente confirmar ingredientes y precio." }),
  product({ p: "Taco Pollo", c: "Tacos", pr: 0, st: "draft", obs: "Pendiente confirmar ingredientes y precio." }),
  product({ p: "Taco Carne", c: "Tacos", pr: 0, st: "draft", obs: "Pendiente confirmar ingredientes y precio." }),

  // ===== BLOQUE 4: Pastas =====
  product({
    p: "Ravioles Rellenos",
    c: "Pastas",
    pr: 350,
    obs: "El cliente selecciona el relleno. Rellenos disponibles: Verdura, Jamón y Queso, Pollo, Ricota. Mismo precio para todos."
  }),
  product({ p: "Tallarines con Tuco", c: "Pastas", ing: "Tallarines, tuco", pr: 290 }),
  product({ p: "Tortelines con Tuco", c: "Pastas", ing: "Tortelines, tuco", pr: 330 }),

  // ===== BLOQUE 4: Menú Combos =====
  // Nota: "Combo Nº3" aparece tanto en Chivitos (Bloque 2) como en Menu
  // Combos (Bloque 4) describiendo el mismo producto real; se carga una
  // sola vez aca, con el nombre combinado y los ingredientes mas
  // detallados del Bloque 2.
  product({
    p: "Combo Nº1",
    c: "Menú Combos",
    ing: "XIS de pollo, papas fritas, refresco medio",
    pr: 450
  }),
  product({
    p: "Combo Nº2",
    c: "Menú Combos",
    ing: "Hamburguesa a elección, papas fritas, refresco medio",
    pr: 490,
    obs: "Opciones de hamburguesa: Especial, BBQ (Barbecue), 4Q (Cuatro quesos)."
  }),
  product({
    p: "Combo Nº3 - Chivito con Papas Rústicas",
    c: "Menú Combos",
    ing: "Pan, churrasco de lomo, lechuga, tomate, huevo, jamón, panceta, muzzarella, papas rústicas 200 g, refresco medio a elección",
    pr: 650
  }),
  product({
    p: "Combo Nº4",
    c: "Menú Combos",
    ing: "Hamburguesa doble carne a elección, papas fritas, refresco medio",
    pr: 570,
    obs: "Puede elegir cualquier hamburguesa de la categoria Doble Carne."
  }),
  product({
    p: "Combo Nº5",
    c: "Menú Combos",
    ing: "2 hamburguesas especiales, papas fritas, refresco grande",
    pr: 890
  }),
  product({
    p: "Combo Nº6",
    c: "Menú Combos",
    ing: "Pancho completo (Pancho con Muzzarella y Panceta), papas fritas, refresco medio",
    pr: 350
  }),
  product({
    p: "Combo Nº7",
    c: "Menú Combos",
    ing: "3 hamburguesas clásicas, papas fritas, refresco grande",
    pr: 1200,
    obs: "Puede elegir cualquier hamburguesa de la categoria Clásicas."
  }),

  // ===== BLOQUE 4: Combo Niños =====
  product({
    p: "Mini Burger",
    c: "Combo Niños",
    ing: "Mini burger Schneck, papitas, jugo Big C",
    pr: 200,
    br: "Schneck",
    obs: "Mini burger es una hamburguesa pequeña congelada marca Schneck."
  }),
  product({
    p: "Combo Nº2 Niños",
    c: "Combo Niños",
    ing: "Nuggets, noisette, jugo Big C",
    pr: 300
  }),

  // ===== BLOQUE 5: Cervezas Industriales =====
  product({ p: "Schola (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 60 }),
  product({ p: "Schola (Lata 500 ml, Pack x12)", c: "Bebidas", sc: "Cervezas Industriales", pr: 600 }),
  product({ p: "Norteña (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 80 }),
  product({ p: "Norteña (Lata 500 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 450 }),
  product({ p: "Norteña (Botella 1 litro)", c: "Bebidas", sc: "Cervezas Industriales", pr: 220 }),
  product({ p: "Patricia (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 100 }),
  product({ p: "Patricia (Lata 500 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 570 }),
  product({ p: "Patricia (Botella 1 litro)", c: "Bebidas", sc: "Cervezas Industriales", pr: 250 }),
  product({ p: "Patricia Dunkel (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 120 }),
  product({ p: "Patricia Dunkel (Lata 500 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 660 }),
  product({ p: "Zillertal (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 110 }),
  product({ p: "Zillertal (Lata 500 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 600 }),
  product({ p: "Zillertal (Botella 1 litro)", c: "Bebidas", sc: "Cervezas Industriales", pr: 260 }),
  product({ p: "Corona (Botella 355 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 80 }),
  product({ p: "Corona (Botella 355 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 450 }),
  product({ p: "Budweiser (Botella 330 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 90 }),
  product({ p: "Budweiser (Botella 330 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 490 }),
  product({ p: "Heineken 0 Alc (Botella 330 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 100, obs: "Sin alcohol." }),
  product({
    p: "Heineken 0 Alc (Botella 330 ml, Pack x4)",
    c: "Bebidas",
    sc: "Cervezas Industriales",
    pr: 380,
    obs: "Sin alcohol."
  }),
  product({ p: "Stella Artois (Botella 330 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 90 }),
  product({ p: "Stella Artois (Botella 330 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 490 }),
  product({ p: "Stella Artois (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 120 }),
  product({ p: "Stella Artois (Lata 500 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 590 }),
  product({ p: "Stella Artois (Botella 1 litro)", c: "Bebidas", sc: "Cervezas Industriales", pr: 280 }),
  product({
    p: "Stella Artois Sin Alcohol (Botella 330 ml)",
    c: "Bebidas",
    sc: "Cervezas Industriales",
    pr: 100
  }),
  product({
    p: "Stella Artois Sin Alcohol (Botella 330 ml, Pack x6)",
    c: "Bebidas",
    sc: "Cervezas Industriales",
    pr: 570
  }),
  product({ p: "Patricia Sin Gluten (Chopito 340 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 90 }),
  product({ p: "Patricia Sin Gluten (Chopito 340 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 490 }),
  product({ p: "Heineken (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 110 }),
  product({ p: "Heineken (Lata 500 ml, Pack x12)", c: "Bebidas", sc: "Cervezas Industriales", pr: 1080 }),
  product({ p: "Zillertal IPA (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 140 }),
  product({ p: "Zillertal IPA (Lata 500 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 780 }),
  product({ p: "Zillertal APA (Lata 500 ml)", c: "Bebidas", sc: "Cervezas Industriales", pr: 140 }),
  product({ p: "Zillertal APA (Lata 500 ml, Pack x6)", c: "Bebidas", sc: "Cervezas Industriales", pr: 750 }),

  // ===== BLOQUE 5: Cervezas Artesanales (Cabezas Bier) =====
  product({
    p: "Cabutiña (Botella 500 ml)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    br: "Cabezas Bier",
    pr: 185,
    obs: "Sabor zapallo."
  }),
  product({
    p: "Bárbara (Botella 500 ml)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    br: "Cabezas Bier",
    pr: 185,
    obs: "Sabor trigo."
  }),
  product({ p: "Mammut Brut IPA (Botella 500 ml)", c: "Bebidas", sc: "Cervezas Artesanales", br: "Cabezas Bier", pr: 185 }),
  product({
    p: "IPA Session Sin Alcohol (Botella 500 ml)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    br: "Cabezas Bier",
    pr: 185
  }),
  product({
    p: "Patota (Botella 500 ml)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    br: "Cabezas Bier",
    pr: 200,
    obs: "Juicy IPA."
  }),

  // ===== BLOQUE 6: Envases =====
  product({
    p: "Envase Botellón Vidrio (2 litros)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    pr: 200,
    obs: "Envase."
  }),
  product({
    p: "Envase Botellón Vidrio (1 litro)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    pr: 150,
    obs: "Envase."
  }),
  product({
    p: "Envase PET Plástico Descartable (1 litro)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    pr: 20,
    obs: "Envase descartable."
  }),

  // ===== BLOQUE 6: Growlers - Tirada =====
  product({ p: "Blondie (1 litro)", c: "Bebidas", sc: "Cervezas Artesanales", scd: "Growlers - Tirada", pr: 230 }),
  product({ p: "Scottish (1 litro)", c: "Bebidas", sc: "Cervezas Artesanales", scd: "Growlers - Tirada", pr: 230 }),
  product({ p: "APA Revolution (1 litro)", c: "Bebidas", sc: "Cervezas Artesanales", scd: "Growlers - Tirada", pr: 250 }),
  product({ p: "IPA Atómica (1 litro)", c: "Bebidas", sc: "Cervezas Artesanales", scd: "Growlers - Tirada", pr: 250 }),
  product({ p: "Sabotaje (1 litro)", c: "Bebidas", sc: "Cervezas Artesanales", scd: "Growlers - Tirada", pr: 250 }),
  product({ p: "Gin Tonic (1 litro)", c: "Bebidas", sc: "Cervezas Artesanales", scd: "Growlers - Tirada", pr: 250 }),
  product({
    p: "Gin Tonic Frutos Rojos (1 litro)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    scd: "Growlers - Tirada",
    pr: 250
  }),
  product({
    p: "Gin Tonic Pomelo (1 litro)",
    c: "Bebidas",
    sc: "Cervezas Artesanales",
    scd: "Growlers - Tirada",
    pr: 250
  }),
  product({ p: "Doble IPA (1 litro)", c: "Bebidas", sc: "Cervezas Artesanales", scd: "Growlers - Tirada", pr: 270 }),

  // ===== BLOQUE 6: Whiskies =====
  product({ p: "Old Parr", c: "Bebidas", sc: "Whiskies", pr: 1490 }),
  product({ p: "Johnny Walker Black", c: "Bebidas", sc: "Whiskies", pr: 1390 }),
  product({ p: "Jack Daniels", c: "Bebidas", sc: "Whiskies", pr: 1290 }),
  product({ p: "Sandy Mac", c: "Bebidas", sc: "Whiskies", pr: 890 }),
  product({ p: "Johnny Walker Red", c: "Bebidas", sc: "Whiskies", pr: 790 }),
  product({ p: "VAT69", c: "Bebidas", sc: "Whiskies", pr: 690 }),
  product({ p: "William Lawson's", c: "Bebidas", sc: "Whiskies", pr: 590 }),
  product({ p: "Sir Edward", c: "Bebidas", sc: "Whiskies", pr: 550 }),

  // ===== BLOQUE 6: Vinos en Caja =====
  product({ p: "Santa Teresa Tinto Clásico", c: "Bebidas", sc: "Vinos en Caja", pr: 180 }),
  product({ p: "Santa Teresa Tinto Suave", c: "Bebidas", sc: "Vinos en Caja", pr: 180 }),
  product({ p: "Santa Teresa Rosado Clásico", c: "Bebidas", sc: "Vinos en Caja", pr: 180 }),
  product({ p: "Santa Teresa Rosado Dulce", c: "Bebidas", sc: "Vinos en Caja", pr: 180 }),
  product({ p: "Santa Teresa Blanco Dulce", c: "Bebidas", sc: "Vinos en Caja", pr: 180 }),
  product({ p: "Santa Teresa Blanco Clásico", c: "Bebidas", sc: "Vinos en Caja", pr: 180 }),
  product({ p: "Santa Teresa Tannat Varietal", c: "Bebidas", sc: "Vinos en Caja", pr: 195 }),
  product({ p: "Santa Teresa Cabernet Varietal", c: "Bebidas", sc: "Vinos en Caja", pr: 195 }),
  product({ p: "Rosés Tinto Suave", c: "Bebidas", sc: "Vinos en Caja", pr: 190 }),

  // ===== BLOQUE 7: Vinos Embotellados =====
  product({ p: "C y Toro - Reservado - Shiraz", c: "Bebidas", sc: "Vinos Embotellados", pr: 390 }),
  product({ p: "C y Toro - Reservado - Carménère", c: "Bebidas", sc: "Vinos Embotellados", pr: 390 }),
  product({ p: "C y Toro - Reservado - Cabernet", c: "Bebidas", sc: "Vinos Embotellados", pr: 390 }),
  product({ p: "C y Toro - Reservado - Malbec", c: "Bebidas", sc: "Vinos Embotellados", pr: 390 }),
  product({ p: "C y Toro - Reservado - Merlot", c: "Bebidas", sc: "Vinos Embotellados", pr: 390 }),
  product({ p: "C y Toro - Reservado - Sauvignon Blanc", c: "Bebidas", sc: "Vinos Embotellados", pr: 390 }),
  product({
    p: "C y Toro - Reservado - Blanco Spritzer (Espumante)",
    c: "Bebidas",
    sc: "Vinos Embotellados",
    pr: 390
  }),
  product({ p: "Casillero del Diablo", c: "Bebidas", sc: "Vinos Embotellados", pr: 550 }),

  // ===== BLOQUE 7: Otras Bebidas =====
  product({ p: "Jagermeister (Botella 700 ml)", c: "Bebidas", sc: "Otras Bebidas", pr: 790 }),
  product({ p: "Vino Espumante (Botella 750 ml)", c: "Bebidas", sc: "Otras Bebidas", pr: 390 }),
  product({ p: "Ananá Fizz (Botella 750 ml)", c: "Bebidas", sc: "Otras Bebidas", pr: 250 }),
  product({ p: "Sidra (Botella 750 ml)", c: "Bebidas", sc: "Otras Bebidas", pr: 250 }),
  product({ p: "Fernet Branca (Botella 1 litro)", c: "Bebidas", sc: "Otras Bebidas", pr: 790 }),
  product({ p: "Amarga Vesubio", c: "Bebidas", sc: "Otras Bebidas", pr: 490 }),
  product({ p: "Grapa Miel Vesubio", c: "Bebidas", sc: "Otras Bebidas", pr: 390 }),
  product({ p: "Smirnoff Ice Bot (Botella 275 ml)", c: "Bebidas", sc: "Otras Bebidas", pr: 130 }),
  product({ p: "Smirnoff Ice Bot (Botella 275 ml, Pack x6)", c: "Bebidas", sc: "Otras Bebidas", pr: 690 }),

  // ===== BLOQUE 7: Combos Bebidas =====
  product({
    p: "Combo Jager",
    c: "Bebidas",
    sc: "Combos Bebidas",
    ing: "Jagermeister, Monster, hielo",
    pr: 900
  }),
  product({
    p: "Combo Branca",
    c: "Bebidas",
    sc: "Combos Bebidas",
    ing: "Fernet Branca, Coca-Cola, hielo",
    pr: 990
  }),

  // ===== BLOQUE 7: Energizantes =====
  product({ p: "Speed (250 ml)", c: "Bebidas", sc: "Energizantes", pr: 110 }),
  product({ p: "Speed (250 ml, Pack x6)", c: "Bebidas", sc: "Energizantes", pr: 600 }),
  product({ p: "Red Bull (250 ml)", c: "Bebidas", sc: "Energizantes", pr: 120 }),
  product({ p: "Red Bull (250 ml, Pack x6)", c: "Bebidas", sc: "Energizantes", pr: 600 }),
  product({ p: "Monster (500 ml)", c: "Bebidas", sc: "Energizantes", pr: 140 }),
  product({ p: "Monster (500 ml, Pack x6)", c: "Bebidas", sc: "Energizantes", pr: 690 }),

  // ===== BLOQUE 8: Cigarros =====
  product({ p: "Coronado GDE (Grande)", c: "Cigarros", pr: 250 }),
  product({ p: "Coronado GDE Free (Grande Free)", c: "Cigarros", pr: 200, obs: "Free Show." }),
  product({ p: "Nevada GDE (Grande)", c: "Cigarros", pr: 250 }),
  product({ p: "Richmond GDE (Grande)", c: "Cigarros", pr: 250 }),
  product({ p: "Gif Mentolado GDE (Grande Mentolado)", c: "Cigarros", pr: 100 }),
  product({ p: "Coronado Chico (Chico)", c: "Cigarros", pr: 130 }),
  product({ p: "Richmond Chico (Chico)", c: "Cigarros", pr: 130 }),
  product({ p: "Nevada Chico (Chico)", c: "Cigarros", pr: 130 }),
  product({ p: "Berry Mint Mentolado Chico (Chico)", c: "Cigarros", pr: 140 }),
  product({ p: "Niagara Mentolado Chico (Chico)", c: "Cigarros", pr: 140 }),

  // ===== BLOQUE 8: Otros =====
  product({ p: "Naipe Tatú", c: "Otros", pr: 250 }),
  product({
    p: "Yerba Canarias (100 gramos)",
    c: "Otros",
    pr: 50,
    obs: "Pendiente confirmar descripción exacta."
  }),
  product({ p: "Preservativos Turipán", c: "Otros", pr: 150 }),
  product({ p: "Rollo de Cocina (Pack x3)", c: "Otros", pr: 120 }),
  product({ p: "Mayonesa Uruguay (500 gramos)", c: "Otros", pr: 150 }),
  product({ p: "Vaso de Plástico (Pack x50 unidades)", c: "Otros", pr: 150 }),
  product({ p: "Vaso de Vidrio (Bar)", c: "Otros", pr: 700 }),
  product({ p: "Copa Media Pinta", c: "Otros", pr: 120 }),
  product({ p: "Copa Pinta", c: "Otros", pr: 150 }),
  product({ p: "Encendedor Bic GDE (Grande)", c: "Otros", pr: 75 }),
  product({ p: "Encendedor Bic Chico (Chico)", c: "Otros", pr: 60 }),
  product({ p: "Chiclets Beldent Negro", c: "Otros", pr: 30 }),
  product({ p: "Pastillas Halls", c: "Otros", pr: 30 }),
  product({ p: "Bolsa de Hielo (2.5 Kg)", c: "Otros", pr: 90 }),
  product({
    p: "Carbón Quebracho (2.5 Kg)",
    c: "Otros",
    pr: 160,
    obs: "Nombre comercial: Carbón 2.5 KG (Quebracho)."
  }),

  // ===== BLOQUE 8: Dulces =====
  product({ p: "Bombón Garoto (Caja)", c: "Dulces", pr: 190 }),
  product({ p: "Tableta Garoto", c: "Dulces", pr: 100 }),
  product({ p: "Chocolate Bis", c: "Dulces", pr: 100 }),
  product({ p: "Maní con Chocolate Portesuelo", c: "Dulces", pr: 90 }),
  product({ p: "Alfajor Portesuelo Triple", c: "Dulces", pr: 40 }),
  product({ p: "Alfajor Portesuelo Black", c: "Dulces", pr: 45 }),
  product({ p: "Galletitas Oreo", c: "Dulces", pr: 120 }),
  product({ p: "Oblea Salvaje", c: "Dulces", pr: 130 }),
  product({ p: "Mini Tortas (500 gramos)", c: "Dulces", pr: 350 }),

  // ===== BLOQUE 8: Helados =====
  product({
    p: "Helado Cruffin Dulce de Leche Granizado (1 litro)",
    c: "Helados",
    pr: 390
  }),
  product({
    p: "Helado Cruffin Vainilla con Salsa de Frutilla (1 litro)",
    c: "Helados",
    pr: 390
  }),
  product({
    p: "Helado Cruffin Triple (1 litro)",
    c: "Helados",
    ing: "Frutilla, chocolate, crema",
    pr: 390
  }),
  product({
    p: "Helado Cruffin Flan con Dulce de Leche (1 litro)",
    c: "Helados",
    pr: 390
  }),

  // ===== BLOQUE 9: Salados =====
  product({ p: "Manix (Maní pelado 150 gramos)", c: "Salados", pr: 110 }),
  product({ p: "Maní Tipo Japonés (100 gramos)", c: "Salados", pr: 80 }),
  product({ p: "Palit Chip Jamón (150 gramos)", c: "Salados", pr: 110 }),
  product({ p: "Papas Lays Stax (Tubo)", c: "Salados", pr: 250 }),
  product({ p: "Twistos (95 gramos)", c: "Salados", pr: 120 }),
  product({ p: "Papas Lays (86 gramos)", c: "Salados", pr: 160 }),
  product({ p: "Doritos (95 gramos)", c: "Salados", pr: 160 }),
  product({ p: "Ruffles (90 gramos)", c: "Salados", pr: 160 }),
  product({ p: "Conitos 3D (88 gramos)", c: "Salados", pr: 160 }),
  product({ p: "Aceitunas Sin Carozo (190 gramos)", c: "Salados", pr: 80 }),

  // ===== BLOQUE 9: Carnes y Anexos =====
  product({ p: "Arañita (Al vacío)", c: "Carnes y Anexos", pr: 450, pu: "kg" }),
  product({ p: "Arañita Premium (Al vacío)", c: "Carnes y Anexos", pr: 550, pu: "kg" }),
  product({ p: "Colita de Cuadril (Al vacío)", c: "Carnes y Anexos", pr: 600, pu: "kg" }),
  product({
    p: "Chorizo Centenario (10 unidades)",
    c: "Carnes y Anexos",
    pr: 490,
    pu: "kg",
    obs: "Viene en pack de 10 unidades pero se vende por kilo."
  }),
  product({ p: "Hamburguesas Centenario (Pack x2)", c: "Carnes y Anexos", pr: 100 }),
  product({ p: "Pan de Ajo Cruffin", c: "Carnes y Anexos", pr: 180 }),
  product({ p: "Papas para Freír (2 Kg)", c: "Carnes y Anexos", pr: 350 })
];

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  // Reemplaza los 6 productos demo cargados en la migracion 026 por el
  // catalogo real. Los pedidos guardados no referencian productos por FK
  // (guardan una copia de nombre/precio en el momento), asi que este
  // reemplazo no rompe historial existente.
  await connection.execute(`DELETE FROM saas_joker_products`);

  for (const item of PRODUCTS) {
    await connection.execute(
      `INSERT INTO saas_joker_products
         (name, category, subcategory, subcategory_detail, brand, price, ingredients, observations, product_type, status, pricing_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.name,
        item.category,
        item.subcategory,
        item.subcategoryDetail,
        item.brand,
        item.price,
        item.ingredients,
        item.observations,
        item.productType,
        item.status,
        item.pricingUnit
      ]
    );
  }

  console.log(`seed-joker-products-ok: ${PRODUCTS.length} productos cargados`);
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
