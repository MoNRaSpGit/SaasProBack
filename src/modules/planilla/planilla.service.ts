import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

export type PlanillaPlayer = { id: number; firstName: string; lastName: string };
export type PlanillaTeam = { id: number; name: string; division: "A" | "B"; sex: "masculino" | "femenino"; players: PlanillaPlayer[] };

type TeamRow = RowDataPacket & { id: number; name: string; division: "A" | "B"; sex: "masculino" | "femenino" };
type PlayerRow = RowDataPacket & { id: number; team_id: number; first_name: string; last_name: string };

// Planilla de voley (26/10/2026): cuadros con sus jugadores (copiados de
// juez, ver scripts/copy-juez-to-planilla.js) para elegir Local y
// Visitante. Solo nombre y apellido; los numeros de camiseta y los
// liberos se ponen en la app al armar el partido.
@Injectable()
export class PlanillaService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCatalog(): Promise<{ teams: PlanillaTeam[] }> {
    const [teams, players] = await Promise.all([
      this.databaseService.query<TeamRow[]>(`SELECT id, name, division, sex FROM saas_planilla_teams ORDER BY name ASC`),
      this.databaseService.query<PlayerRow[]>(
        `SELECT id, team_id, first_name, last_name FROM saas_planilla_players ORDER BY last_name ASC, first_name ASC`
      )
    ]);
    const playersByTeam = new Map<number, PlanillaPlayer[]>();
    for (const player of players) {
      const list = playersByTeam.get(player.team_id) ?? [];
      list.push({ id: player.id, firstName: player.first_name, lastName: player.last_name });
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
