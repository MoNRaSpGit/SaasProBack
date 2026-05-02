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
  const email = `sale-${suffix}@saaspro.test`;
  const password = "demo12345";
  const fullName = `Sale Demo ${suffix}`;
  const tenantName = `Sale Tenant ${suffix}`;

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

    const createProductResponse = await fetch(`${baseUrl}/pos/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: `Yerba ${suffix}`,
        sku: `SKU-${suffix}`,
        barcode: `BAR-${suffix}`,
        salePrice: 220,
        costPrice: 150
      })
    });
    const createProductPayload = await readJson(createProductResponse);
    if (!createProductResponse.ok || !createProductPayload.item?.id) {
      throw new Error(`Create product failed: ${JSON.stringify(createProductPayload)}`);
    }

    const saleResponse = await fetch(`${baseUrl}/pos/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        externalId: `sale-${suffix}`,
        notes: "venta de prueba saas",
        items: [
          {
            productId: createProductPayload.item.id,
            name: createProductPayload.item.name,
            unitPrice: createProductPayload.item.salePrice,
            quantity: 2
          },
          {
            isManual: true,
            name: `Producto Manual ${suffix}`,
            unitPrice: 75.5,
            quantity: 1
          }
        ]
      })
    });
    const salePayload = await readJson(saleResponse);
    if (!saleResponse.ok) {
      throw new Error(`Create sale failed: ${JSON.stringify(salePayload)}`);
    }

    const listSalesResponse = await fetch(`${baseUrl}/pos/sales`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const listSalesPayload = await readJson(listSalesResponse);
    if (!listSalesResponse.ok) {
      throw new Error(`List sales failed: ${JSON.stringify(listSalesPayload)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          register: {
            email: registerPayload.user.email,
            tenant: registerPayload.tenantContext?.tenant.name,
            modules: registerPayload.tenantContext?.modules || []
          },
          createdProduct: createProductPayload.item,
          createdSale: salePayload.sale,
          listedSalesCount: listSalesPayload.meta?.count,
          listedSales: listSalesPayload.items
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
