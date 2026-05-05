import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";
import { NeonRequestUser, NeonShellStatus } from "./neon.types";

@Injectable()
export class NeonService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus(currentUser: NeonRequestUser): Promise<NeonShellStatus> {
    await this.databaseService.checkConnection();

    return {
      module: "neon",
      tenant: {
        id: currentUser.tenantId,
        name: currentUser.tenantName,
        slug: currentUser.tenantSlug
      },
      user: {
        id: currentUser.userId,
        email: currentUser.email,
        membershipRole: currentUser.membershipRole
      },
      backend: {
        database: "connected",
        currentTimestamp: new Date().toISOString()
      },
      phase: "shell"
    };
  }
}
