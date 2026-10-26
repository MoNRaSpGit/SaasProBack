// Copia cuadros y jugadores de juez a la planilla de voley (26/10/2026).
// Solo AGREGA lo que falta (INSERT IGNORE por juez_*_id): se puede volver
// a correr cuando juez sume cuadros o jugadores, sin duplicar ni borrar.
// Uso: node scripts/copy-juez-to-planilla.js [--apply]   (sin --apply solo cuenta)
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

async function main() {
  loadEnvFile();
  const apply = process.argv.includes("--apply");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  try {
    const [teams] = await connection.query("SELECT id, name, division, sex FROM saas_juez_teams");
    const [players] = await connection.query("SELECT id, team, division, sex, name, last_name FROM saas_juez_players");
    console.log(`juez: ${teams.length} cuadros, ${players.length} jugadores`);
    if (!apply) return;

    await connection.beginTransaction();
    for (const team of teams) {
      await connection.query("INSERT IGNORE INTO saas_planilla_teams (juez_team_id, name, division, sex) VALUES (?, ?, ?, ?)", [
        team.id,
        team.name.trim(),
        team.division,
        team.sex
      ]);
    }
    const [planillaTeams] = await connection.query("SELECT id, name, division, sex FROM saas_planilla_teams");
    const teamIdByKey = new Map(planillaTeams.map((team) => [`${team.name}|${team.division}|${team.sex}`, team.id]));
    let skipped = 0;
    for (const player of players) {
      const teamId = teamIdByKey.get(`${player.team.trim()}|${player.division}|${player.sex}`);
      if (!teamId) {
        skipped += 1;
        continue;
      }
      await connection.query(
        "INSERT IGNORE INTO saas_planilla_players (team_id, juez_player_id, first_name, last_name) VALUES (?, ?, ?, ?)",
        [teamId, player.id, player.name.trim(), (player.last_name || "").trim()]
      );
    }
    await connection.commit();
    const [[{ t }]] = await connection.query("SELECT COUNT(*) t FROM saas_planilla_teams");
    const [[{ p }]] = await connection.query("SELECT COUNT(*) p FROM saas_planilla_players");
    console.log(`planilla: ${t} cuadros, ${p} jugadores (sin cuadro: ${skipped})`);
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
