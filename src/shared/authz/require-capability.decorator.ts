import { SetMetadata } from "@nestjs/common";
import { TenantCapability } from "./capabilities";

export const REQUIRED_CAPABILITY_KEY = "required_capability";

export const RequireCapability = (capability: TenantCapability) => SetMetadata(REQUIRED_CAPABILITY_KEY, capability);
