export type JuezPlayerDivision = "A" | "B";
export type JuezPlayerSex = "masculino" | "femenino";

export type JuezPlayer = {
  id: number;
  team: string;
  division: JuezPlayerDivision;
  sex: JuezPlayerSex;
  name: string;
  lastName: string;
  expiryDate: string;
  cedula: string | null;
  phone: string | null;
  birthDate: string | null;
  photoDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
