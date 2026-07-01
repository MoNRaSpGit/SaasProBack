import "reflect-metadata";
import * as fs from "node:fs";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createConnection } from "mysql2/promise";
import { AppModule } from "../src/app.module";

type AuthPayload = {
  tokens?: {
    accessToken: string;
  };
  tenantContext?: {
    tenant: {
      id: number;
      name: string;
      slug: string;
    };
  } | null;
  message?: string | string[];
};

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function buildUniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile();

  const suffix = buildUniqueSuffix();
  const email = `alamcen-${suffix}@saaspro.test`;
  const password = "test-only-password";
  const fullName = `Almacen Demo ${suffix}`;
  const tenantName = `Almacen Tenant ${suffix}`;

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
    const registerPayload = (await readJson(registerResponse)) as AuthPayload;
    if (!registerResponse.ok || !registerPayload.tokens?.accessToken || !registerPayload.tenantContext?.tenant.id) {
      throw new Error(`Register failed: ${JSON.stringify(registerPayload)}`);
    }

    const connection = await createConnection({ uri: process.env.DATABASE_URL });
    await connection.query(
      `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
       VALUES (?, 'alamcen', 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [registerPayload.tenantContext.tenant.id]
    );
    await connection.end();

    const authHeaders = {
      Authorization: `Bearer ${registerPayload.tokens.accessToken}`,
      "Content-Type": "application/json"
    };

    const statusResponse = await fetch(`${baseUrl}/alamcen/status`, { headers: authHeaders });
    const statusPayload = await readJson(statusResponse);
    if (!statusResponse.ok || statusPayload?.module !== "alamcen") {
      throw new Error(`Almacen status failed: ${JSON.stringify(statusPayload)}`);
    }

    const createProductResponse = await fetch(`${baseUrl}/alamcen/productos/manual`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        barcode: `7790${Date.now()}`,
        price: 125
      })
    });
    const createProductPayload = await readJson(createProductResponse);
    if (!createProductResponse.ok || !createProductPayload?.id) {
      throw new Error(`Create manual product failed: ${JSON.stringify(createProductPayload)}`);
    }

    const lookupResponse = await fetch(
      `${baseUrl}/alamcen/productos/barcode/${encodeURIComponent(createProductPayload.barcodeNormalized || createProductPayload.barcode)}`,
      { headers: authHeaders }
    );
    const lookupPayload = await readJson(lookupResponse);
    if (!lookupResponse.ok || !lookupPayload?.id) {
      throw new Error(`Barcode lookup failed: ${JSON.stringify(lookupPayload)}`);
    }

    const saleResponse = await fetch(`${baseUrl}/alamcen/sales`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        externalId: `sale-${suffix}`,
        items: [
          {
            productId: createProductPayload.id,
            nombre: createProductPayload.nombre,
            precioVenta: createProductPayload.precioVenta,
            quantity: 2
          }
        ]
      })
    });
    const salePayload = await readJson(saleResponse);
    if (!saleResponse.ok || !salePayload?.sale?.id) {
      throw new Error(`Create sale failed: ${JSON.stringify(salePayload)}`);
    }

    const paymentResponse = await fetch(`${baseUrl}/alamcen/payments`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        externalId: `payment-${suffix}`,
        amount: 40,
        description: `Pago demo ${suffix}`
      })
    });
    const paymentPayload = await readJson(paymentResponse);
    if (!paymentResponse.ok || !paymentPayload?.payment?.id) {
      throw new Error(`Create payment failed: ${JSON.stringify(paymentPayload)}`);
    }

    const dashboardResponse = await fetch(`${baseUrl}/alamcen/dashboard`, { headers: authHeaders });
    const dashboardPayload = await readJson(dashboardResponse);
    if (!dashboardResponse.ok || !dashboardPayload?.dashboard?.metrics) {
      throw new Error(`Dashboard failed: ${JSON.stringify(dashboardPayload)}`);
    }

    const listProductsResponse = await fetch(`${baseUrl}/alamcen/products?search=Producto`, { headers: authHeaders });
    const listProductsPayload = await readJson(listProductsResponse);
    if (!listProductsResponse.ok || !Array.isArray(listProductsPayload?.items)) {
      throw new Error(`List products failed: ${JSON.stringify(listProductsPayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenant: registerPayload.tenantContext.tenant,
          status: statusPayload,
          product: createProductPayload,
          lookup: lookupPayload,
          sale: salePayload.sale,
          payment: paymentPayload.payment,
          dashboard: dashboardPayload.dashboard,
          listedProductsCount: listProductsPayload.items.length
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
