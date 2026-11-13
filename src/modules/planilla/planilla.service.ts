import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

export type PlanillaPlayer = { id: number; firstName: string; lastName: string; expiryDate: string | null };
export type PlanillaTeam = { id: number; name: string; division: "A" | "B"; sex: "masculino" | "femenino"; players: PlanillaPlayer[] };

type TeamRow = RowDataPacket & { id: number; name: string; division: "A" | "B"; sex: "masculino" | "femenino" };
type PlayerRow = RowDataPacket & { id: number; team_id: number; first_name: string; last_name: string; expiry: string | null };

// Planilla de voley: cuadros con sus jugadores para elegir Local y
// Visitante. Desde el 13/11/2026 la FUENTE UNICA DE DATOS es juez
// (saas_juez_teams / saas_juez_players): nombres, cuadros y vencimiento del
// carne se leen de ahi en cada consulta. Las tablas saas_planilla_* ya no
// guardan datos propios, solo conservan el id que usa la planilla (los
// numeros de camiseta que recuerda cada celular van atados a ese id).
// Lo nuevo de juez se enlaza solo, sin correr scripts.
@Injectable()
export class PlanillaService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Enlaza con juez lo que falta: cuadros y jugadores nuevos reciben su id de planilla.
  private async syncFromJuez() {
    // Un cuadro viejo de planilla cuyo cuadro de juez ya no existe se vuelve a
    // atar al de juez con el mismo nombre/division/sexo (si lo hay).
    await this.databaseService.execute(
      `UPDATE saas_planilla_teams pt
       JOIN saas_juez_teams jt ON jt.name = pt.name AND jt.division = pt.division AND jt.sex = pt.sex
       SET pt.juez_team_id = jt.id
       WHERE pt.juez_team_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM saas_juez_teams x WHERE x.id = pt.juez_team_id)`
    );
    await this.databaseService.execute(
      `INSERT IGNORE INTO saas_planilla_teams (juez_team_id, name, division, sex)
       SELECT jt.id, jt.name, jt.division, jt.sex
       FROM saas_juez_teams jt
       WHERE NOT EXISTS (SELECT 1 FROM saas_planilla_teams pt WHERE pt.juez_team_id = jt.id)`
    );
    await this.databaseService.execute(
      `INSERT IGNORE INTO saas_planilla_players (team_id, juez_player_id, first_name, last_name)
       SELECT pt.id, jp.id, jp.name, jp.last_name
       FROM saas_juez_players jp
       JOIN saas_juez_teams jt ON jt.name = jp.team AND jt.division = jp.division AND jt.sex = jp.sex
       JOIN saas_planilla_teams pt ON pt.juez_team_id = jt.id
       WHERE NOT EXISTS (SELECT 1 FROM saas_planilla_players pp WHERE pp.juez_player_id = jp.id)`
    );
  }

  async getCatalog(): Promise<{ teams: PlanillaTeam[] }> {
    await this.syncFromJuez();
    const [teams, players] = await Promise.all([
      this.databaseService.query<TeamRow[]>(
        `SELECT pt.id, jt.name, jt.division, jt.sex
         FROM saas_planilla_teams pt
         JOIN saas_juez_teams jt ON jt.id = pt.juez_team_id
         ORDER BY jt.name ASC`
      ),
      this.databaseService.query<PlayerRow[]>(
        `SELECT pp.id, pp.team_id, jp.name AS first_name, jp.last_name,
                DATE_FORMAT(jp.expiry_date, '%Y-%m-%d') AS expiry
         FROM saas_planilla_players pp
         JOIN saas_juez_players jp ON jp.id = pp.juez_player_id
         ORDER BY jp.last_name ASC, jp.name ASC`
      )
    ]);
    const playersByTeam = new Map<number, PlanillaPlayer[]>();
    for (const player of players) {
      const list = playersByTeam.get(player.team_id) ?? [];
      list.push({ id: player.id, firstName: player.first_name, lastName: player.last_name, expiryDate: player.expiry });
      playersByTeam.set(player.team_id, list);
    }
    return {
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        division: team.division,
        sex: team.sex,
        players: playersByTeam.get(team.id) ?? []
      }))
    };
  }
}
