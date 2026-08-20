export type JuezMatchStatus = "open" | "closed" | "assigned";

export type JuezMatch = {
  id: string;
  tournament: string;
  homeSide: string;
  awaySide: string;
  venue: string;
  date: string;
  time: string;
  status: JuezMatchStatus;
};

export type JuezAvailabilityEntry = {
  matchId: string;
  refereeId: string;
  createdAt: string;
};

export type JuezAssignment = {
  matchId: string;
  principalRefereeId: string;
  secondaryRefereeId: string;
  scorerRefereeId: string;
  confirmedAt: string;
};
