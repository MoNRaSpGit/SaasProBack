const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

const fixes = [
  { id: 17, buyerName: "Florencia Rodríguez" },
  { id: 18, buyerName: "Héctor Píriz" },
  { id: 19, buyerName: "Andrea Rodríguez" },
  { id: 21, buyerName: "Omar Díaz" }
];

async function main() {
  loadEnvFile();
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, charset: "utf8mb4" });

  for (const fix of fixes) {
    await connection.execute("UPDATE saas_carnet_event_player_buyers SET buyer_name = ? WHERE id = ?", [
      fix.buyerName,
      fix.id
    ]);
    console.log("actualizado id", fix.id, "->", fix.buyerName);
  }

  const [rows] = await connection.query(
    "SELECT id, buyer_name FROM saas_carnet_event_player_buyers WHERE id IN (17, 18, 19, 21)"
  );
  console.log(rows);

  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
