import { JuezPlayerDivision, JuezPlayerSex } from "../players/juez-players.types";

export type JuezTeam = {
  id: number;
  name: string;
  division: JuezPlayerDivision;
  sex: JuezPlayerSex;
  createdAt: string;
  updatedAt: string;
};
