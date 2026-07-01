import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createConnection, RowDataPacket } from "mysql2/promise";
import { AppModule } from "../src/app.module";

type AuthResponse = {
  user?: {
    id: number;
    email: string;
    fullName: string | null;
    role: string;
  };
  tenantContext?: {
    tenant: {
      id: number;
      name: string;
      slug: string;
      status: string;
    };
    membership: {
      role: string;
      status: string;
      isDefault: boolean;
    };
    billing: {
      status: string;
      paidUntil: string | null;
      graceUntil: string | null;
      blockedReason: string | null;
    };
    modules: string[];
  } | null;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    accessTtl: string;
    refreshTtl: string;
  };
  message?: string | string[];
};

type TenantAuditRow = RowDataPacket & {
  email: string;
  tenant_name: string;
  tenant_slug: string;
  membership_role: string;
  membership_status: string;
  membership_is_default: number;
  brand_name: string | null;
  billing_status: string;
  paid_until: string | null;
  grace_until: string | null;
  blocked_reason: string | null;
};

function buildUniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function parseJson(response: Response) {
  const text = await response.text();
  return text ? (JSON.parse(text) as AuthResponse) : {};
}

async function main() {
  const suffix = buildUniqueSuffix();
  const tenantName = `Tenant Demo ${suffix}`;
  const email = `multi-${suffix}@saaspro.test`;
  const password = "test-only-password";
  const fullName = `Usuario Demo ${suffix}`;

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
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        fullName,
        tenantName
      })
    });

    const registerPayload = await parseJson(registerResponse);
    if (!registerResponse.ok || !registerPayload.user || !registerPayload.tokens) {
      throw new Error(`Register failed: ${JSON.stringify(registerPayload)}`);
    }

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password
      })
    });

    const loginPayload = await parseJson(loginResponse);
    if (!loginResponse.ok || !loginPayload.user || !loginPayload.tokens) {
      throw new Error(`Login failed: ${JSON.stringify(loginPayload)}`);
    }

    const connection = await createConnection({ uri: process.env.DATABASE_URL });
    const [rows] = await connection.query<TenantAuditRow[]>(
      `SELECT
         u.email,
         t.name AS tenant_name,
         t.slug AS tenant_slug,
         m.role AS membership_role,
         m.status AS membership_status,
         m.is_default AS membership_is_default,
         s.brand_name,
         s.billing_status,
         s.paid_until,
         s.grace_until,
         s.blocked_reason
       FROM saasPro_users u
       INNER JOIN saas_tenant_memberships m ON m.user_id = u.id
       INNER JOIN saas_tenants t ON t.id = m.tenant_id
       LEFT JOIN saas_tenant_settings s ON s.tenant_id = t.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    await connection.end();

    const auditRow = rows[0];
    if (!auditRow) {
      throw new Error("Database audit failed: no tenant context row found");
    }

    if (registerPayload.tenantContext?.billing.status !== "active") {
      throw new Error(`Unexpected register billing status: ${JSON.stringify(registerPayload.tenantContext?.billing)}`);
    }

    if (loginPayload.tenantContext?.billing.status !== "active") {
      throw new Error(`Unexpected login billing status: ${JSON.stringify(loginPayload.tenantContext?.billing)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          register: {
            email: registerPayload.user.email,
            tenantContext: registerPayload.tenantContext
          },
          login: {
            email: loginPayload.user.email,
            tenantContext: loginPayload.tenantContext
          },
          database: {
            email: auditRow.email,
            tenantName: auditRow.tenant_name,
            tenantSlug: auditRow.tenant_slug,
            membershipRole: auditRow.membership_role,
            membershipStatus: auditRow.membership_status,
            membershipIsDefault: Boolean(auditRow.membership_is_default),
            brandName: auditRow.brand_name,
            billingStatus: auditRow.billing_status,
            paidUntil: auditRow.paid_until,
            graceUntil: auditRow.grace_until,
            blockedReason: auditRow.blocked_reason
          }
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
