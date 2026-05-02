import { Injectable } from "@nestjs/common";
import { hasCapability } from "../../shared/authz/capabilities";
import { DistribuidoraRequestUser } from "./distribuidora.types";

@Injectable()
export class DistribuidoraService {
  getStatus(currentUser: DistribuidoraRequestUser) {
    return {
      module: "distribuidora",
      mode: "shell",
      status: "active",
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
      capabilities: {
        orderCapture: hasCapability(currentUser.membershipRole, "distribuidora.shell.read"),
        orderAdmin: hasCapability(currentUser.membershipRole, "distribuidora.admin.read"),
        localDrafts: false,
        backendOrders: false
      },
      message: "Distribuidora ya forma parte oficial del SaaS, pero su funcionalidad todavia esta en modo shell."
    };
  }

  getAdminStatus(currentUser: DistribuidoraRequestUser) {
    return {
      ...this.getStatus(currentUser),
      view: "admin",
      message: "La vista admin de Distribuidora ya esta registrada en el SaaS, pero todavia no tiene operacion real."
    };
  }
}
