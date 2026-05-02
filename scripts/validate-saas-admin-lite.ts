import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createConnection } from "mysql2/promise";
import { AppModule } from "../src/app.module";

type AuthResponse = {
  user?: {
    id: number;
    email: string;
  };
  tokens?: {
    accessToken: string;
  };
  tenantContext?: {
    tenant: {
      id: number;
      name: string;
      slug: string;
    };
    billing: {
      status: string;
      paidUntil: string | null;
      graceUntil: string | null;
      blockedReason: string | null;
    };
  } | null;
  message?: string | string[];
};

function buildUniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

async function main() {
  const suffix = buildUniqueSuffix();
  const email = `saas-admin-${suffix}@saaspro.test`;
  const password = "demo12345";
  const fullName = `SaaS Admin ${suffix}`;
  const tenantName = `SaaS Admin Tenant ${suffix}`;

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  await app.listen(0);

  try {
    const server = app.getHttpServer() as { address(): { port: number } };
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, tenantName })
    });
    const registerPayload = (await readJson(registerResponse)) as AuthResponse;
    if (!registerResponse.ok || !registerPayload.user?.id || !registerPayload.tenantContext?.tenant.id) {
      throw new Error(`Register failed: ${JSON.stringify(registerPayload)}`);
    }

    const connection = await createConnection({ uri: process.env.DATABASE_URL });
    await connection.query(`UPDATE saasPro_users SET role = 'admin' WHERE id = ?`, [registerPayload.user.id]);
    await connection.end();

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const loginPayload = (await readJson(loginResponse)) as AuthResponse;
    if (!loginResponse.ok || !loginPayload.tokens?.accessToken || !loginPayload.tenantContext?.tenant.id) {
      throw new Error(`Login failed: ${JSON.stringify(loginPayload)}`);
    }

    const listResponse = await fetch(`${baseUrl}/saas-admin/tenants`, {
      headers: {
        Authorization: `Bearer ${loginPayload.tokens.accessToken}`
      }
    });
    const listPayload = (await readJson(listResponse)) as {
      availableModules?: string[];
      items?: Array<{ id: number; slug: string; billing: { status: string }; modules: string[] }>;
      total?: number;
      message?: string;
    };
    if (!listResponse.ok || !Array.isArray(listPayload.items)) {
      throw new Error(`List tenants failed: ${JSON.stringify(listPayload)}`);
    }

    const ownTenant = listPayload.items.find((item) => item.id === loginPayload.tenantContext!.tenant.id);
    if (!ownTenant) {
      throw new Error(`Own tenant not visible in SaaS admin: ${JSON.stringify(listPayload)}`);
    }

    for (const moduleKey of ["camiones", "distribuidora", "pos"]) {
      if (!listPayload.availableModules?.includes(moduleKey)) {
        throw new Error(`Expected available module ${moduleKey} in SaaS admin payload`);
      }
    }

    const paidUntil = "2026-11-01";
    const graceUntil = "2026-11-06";

    const updateResponse = await fetch(`${baseUrl}/saas-admin/tenants/${ownTenant.id}/billing`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginPayload.tokens.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        billingStatus: "grace_period",
        paidUntil,
        graceUntil,
        blockedReason: "seguimiento manual"
      })
    });
    const updatePayload = (await readJson(updateResponse)) as {
      billing?: {
        status: string;
        paidUntil: string | null;
        graceUntil: string | null;
        blockedReason: string | null;
      };
      message?: string;
    };
    if (!updateResponse.ok || !updatePayload.billing) {
      throw new Error(`Update billing failed: ${JSON.stringify(updatePayload)}`);
    }

    const updateModulesResponse = await fetch(`${baseUrl}/saas-admin/tenants/${ownTenant.id}/modules`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginPayload.tokens.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        enabledModules: ["camiones", "distribuidora"]
      })
    });
    const updateModulesPayload = (await readJson(updateModulesResponse)) as {
      modules?: string[];
      message?: string;
    };
    if (!updateModulesResponse.ok || !Array.isArray(updateModulesPayload.modules)) {
      throw new Error(`Update modules failed: ${JSON.stringify(updateModulesPayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenantId: ownTenant.id,
          totalTenantsVisible: listPayload.total,
          previousStatus: ownTenant.billing.status,
          updatedBilling: updatePayload.billing,
          updatedModules: updateModulesPayload.modules
        },
        null,
        2
      )
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
