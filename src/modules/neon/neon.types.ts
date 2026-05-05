import { ModuleRequestUser } from "../../shared/authz/module-auth";

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
