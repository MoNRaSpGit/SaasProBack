import { ModuleRequestUser } from "../../shared/authz/module-auth";

export type AgroRequestUser = ModuleRequestUser;

export const AGRO_DISCOVERY_MODULE_KEY = "agro" as const;
export const AGRO_DISCOVERY_VERSION = "v1" as const;
export const AGRO_WORKSPACE_PUBLIC_KEY = "public" as const;
export const AGRO_WORKSPACE_VERSION = "v1" as const;

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

export type AgroWorkspaceData = {
  establishments: unknown[];
  fields: unknown[];
  animalMovements: unknown[];
  accountingEntries: unknown[];
  rainfallRecords: unknown[];
  sanitaryRecords: unknown[];
  monthlyExchangeRates: unknown[];
};

export type AgroWorkspaceRecord = {
  workspaceKey: typeof AGRO_WORKSPACE_PUBLIC_KEY;
  version: typeof AGRO_WORKSPACE_VERSION;
  data: AgroWorkspaceData;
  updatedAt: string | null;
};
