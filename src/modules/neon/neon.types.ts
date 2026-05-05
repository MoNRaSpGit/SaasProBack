import { ModuleRequestUser } from "../../shared/authz/module-auth";
import { NeonActivityType, NeonCommercialStatus } from "./dto/create-neon-activity.dto";
import { NeonCategoryClassification, NeonCategoryMovementType } from "./dto/create-neon-category.dto";
import { NeonExpenseDestinationType } from "./dto/create-neon-expense.dto";

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

export type NeonAccount = {
  id: number;
  tenantId: number;
  name: string;
  accountType: "cash" | "bank";
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type NeonActivityPayment = {
  id: number;
  tenantId: number;
  activityId: number;
  movementId: number;
  accountId: number;
  accountName: string;
  paymentDate: string;
  paidAmount: number;
  description: string | null;
  createdAt: string;
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
  payments?: NeonActivityPayment[];
  createdAt: string;
  updatedAt: string;
};

export type NeonCategory = {
  id: number;
  tenantId: number;
  name: string;
  movementType: NeonCategoryMovementType;
  classification: NeonCategoryClassification;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NeonExpense = {
  id: number;
  tenantId: number;
  movementDate: string;
  accountId: number;
  accountName: string;
  categoryId: number;
  categoryName: string;
  categoryClassification: NeonCategoryClassification;
  totalAmount: number;
  description: string | null;
  destinationType: NeonExpenseDestinationType;
  destinationActivityId: number | null;
  destinationActivityCode: string | null;
  destinationActivityDescription: string | null;
  destinationLabel: string | null;
  createdAt: string;
  updatedAt: string;
};
