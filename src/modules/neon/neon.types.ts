import { ModuleRequestUser } from "../../shared/authz/module-auth";
import { NeonActivityType, NeonCommercialStatus } from "./dto/create-neon-activity.dto";

export type NeonRequestUser = ModuleRequestUser;

export type NeonShellStatus = {
  module: "neon";
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
  user: {
    id: number;
    email: string;
    membershipRole: string;
  };
  backend: {
    database: "connected";
    currentTimestamp: string;
  };
  phase: "shell";
};

export type NeonClient = {
  id: number;
  tenantId: number;
  name: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NeonActivity = {
  id: number;
  tenantId: number;
  activityNumber: number;
  activityYear: number;
  activityDate: string;
  description: string;
  clientId: number | null;
  clientName: string | null;
  activityType: NeonActivityType;
  commercialStatus: NeonCommercialStatus;
  quotedAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  createdAt: string;
  updatedAt: string;
};
