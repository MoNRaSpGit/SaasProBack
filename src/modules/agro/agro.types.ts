import { ModuleRequestUser } from "../../shared/authz/module-auth";

export type AgroRequestUser = ModuleRequestUser;

export const AGRO_DISCOVERY_MODULE_KEY = "agro" as const;
export const AGRO_DISCOVERY_VERSION = "v1" as const;

export type AgroDiscoveryAnswer = {
  questionId: string;
  selectedOption: string;
};

export type AgroDiscoveryResponseRecord = {
  id: number;
  tenantId: number;
  moduleKey: typeof AGRO_DISCOVERY_MODULE_KEY;
  version: typeof AGRO_DISCOVERY_VERSION;
  answeredAt: string;
  answers: AgroDiscoveryAnswer[];
  createdAt: string;
  updatedAt: string;
};
