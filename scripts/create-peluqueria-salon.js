// Crea (o actualiza) una peluqueria con su usuario dueño y sus peluqueros.
// Uso: node scripts/create-peluqueria-salon.js <slug> "<Nombre>" <usuario> <contraseña> "Peluquero1,Peluquero2"
const fs = require("fs");
const mysql = require("mysql2/promise");
const { hash } = require("bcryptjs");

function loadEnvFile() {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

const DEFAULT_SCHEDULE = {
  slotMinutes: 60,
  days: { 1: [["09:00", "19:00"]], 2: [["09:00", "19:00"]], 3: [["09:00", "19:00"]], 4: [["09:00", "19:00"]], 5: [["09:00", "19:00"]], 6: [["09:00", "19:00"]] }
};

async function main() {
  const [slug, name, username, password, barbersArg] = process.argv.slice(2);
  if (!slug || !name || !username || !password || !barbersArg) {
    console.error('Uso: node scripts/create-peluqueria-salon.js <slug> "<Nombre>" <usuario> <contraseña> "Peluquero1,Peluquero2"');
    process.exit(1);
  }
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) throw new Error("slug: solo minusculas, numeros y guiones");
  if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  await connection.query(
    `INSERT INTO saas_peluqueria_salons (slug, name, schedule_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [slug, name, JSON.stringify(DEFAULT_SCHEDULE)]
  );
  const [[salon]] = await connection.query(`SELECT id FROM saas_peluqueria_salons WHERE slug = ?`, [slug]);

  const barbers = barbersArg.split(",").map((value) => value.trim()).filter(Boolean);
  for (let i = 0; i < barbers.length; i++) {
    await connection.query(`INSERT IGNORE INTO saas_peluqueria_barbers (salon_id, name, position) VALUES (?, ?, ?)`, [salon.id, barbers[i], i]);
  }

  // La clave no distingue mayusculas: se guarda en minuscula (ver peluqueria-auth.service.ts).
  const passwordHash = await hash(password.toLowerCase(), 12);
  const user = username.trim().toLowerCase();
  const [[taken]] = await connection.query(`SELECT salon_id FROM saas_peluqueria_users WHERE username = ?`, [user]);
  if (taken && taken.salon_id !== salon.id) throw new Error("Ese usuario ya pertenece a otra peluqueria");
  await connection.query(
    `INSERT INTO saas_peluqueria_users (salon_id, username, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [salon.id, user, passwordHash]
  );
  await connection.end();
  console.log(`ok: peluqueria "${name}" (slug ${slug}), usuario ${user}, peluqueros: ${barbers.join(", ")}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
