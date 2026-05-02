import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";

type RegisterPayload = {
  user: { email: string };
  tokens: { accessToken: string };
  tenantContext: {
    tenant: { id: number; name: string };
    modules: string[];
  } | null;
};

function buildUniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function main() {
  const suffix = buildUniqueSuffix();
  const email = `dashboard-${suffix}@saaspro.test`;
  const password = "demo12345";
  const fullName = `Dashboard Demo ${suffix}`;
  const tenantName = `Dashboard Tenant ${suffix}`;

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
    const registerPayload = (await readJson(registerResponse)) as RegisterPayload;
    if (!registerResponse.ok || !registerPayload.tokens?.accessToken) {
      throw new Error(`Register failed: ${JSON.stringify(registerPayload)}`);
    }

    const accessToken = registerPayload.tokens.accessToken;

    const productResponse = await fetch(`${baseUrl}/pos/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: `Arroz ${suffix}`,
        sku: `DASH-SKU-${suffix}`,
        barcode: `DASH-BAR-${suffix}`,
        salePrice: 180,
        costPrice: 110
      })
    });
    const productPayload = await readJson(productResponse);
    if (!productResponse.ok || !productPayload.item?.id) {
      throw new Error(`Create product failed: ${JSON.stringify(productPayload)}`);
    }

    const saleResponse = await fetch(`${baseUrl}/pos/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        externalId: `dash-sale-${suffix}`,
        items: [
          {
            productId: productPayload.item.id,
            name: productPayload.item.name,
            unitPrice: productPayload.item.salePrice,
            quantity: 2
          }
        ]
      })
    });
    const salePayload = await readJson(saleResponse);
    if (!saleResponse.ok) {
      throw new Error(`Create sale failed: ${JSON.stringify(salePayload)}`);
    }

    const paymentResponse = await fetch(`${baseUrl}/pos/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        externalId: `dash-payment-${suffix}`,
        amount: 55.75,
        description: "Proveedor limpieza"
      })
    });
    const paymentPayload = await readJson(paymentResponse);
    if (!paymentResponse.ok) {
      throw new Error(`Create payment failed: ${JSON.stringify(paymentPayload)}`);
    }

    const dashboardResponse = await fetch(`${baseUrl}/pos/dashboard?movementLimit=5&rankingLimit=5`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const dashboardPayload = await readJson(dashboardResponse);
    if (!dashboardResponse.ok) {
      throw new Error(`Dashboard failed: ${JSON.stringify(dashboardPayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          register: {
            email: registerPayload.user.email,
            tenant: registerPayload.tenantContext?.tenant.name
          },
          sale: salePayload.sale,
          payment: paymentPayload.payment,
          dashboard: dashboardPayload
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
