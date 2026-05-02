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
  const email = `pos-${suffix}@saaspro.test`;
  const password = "demo12345";
  const fullName = `POS Demo ${suffix}`;
  const tenantName = `POS Tenant ${suffix}`;

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

    const createResponse = await fetch(`${baseUrl}/pos/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: `Yerba ${suffix}`,
        sku: `SKU-${suffix}`,
        barcode: `BAR-${suffix}`,
        salePrice: 199.9,
        costPrice: 120.4
      })
    });
    const createPayload = await readJson(createResponse);
    if (!createResponse.ok) {
      throw new Error(`Create product failed: ${JSON.stringify(createPayload)}`);
    }

    const listResponse = await fetch(`${baseUrl}/pos/products`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const listPayload = await readJson(listResponse);
    if (!listResponse.ok) {
      throw new Error(`List products failed: ${JSON.stringify(listPayload)}`);
    }

    const lookupBarcodeResponse = await fetch(
      `${baseUrl}/pos/products/lookup?barcode=${encodeURIComponent(`BAR-${suffix}`)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    const lookupBarcodePayload = await readJson(lookupBarcodeResponse);
    if (!lookupBarcodeResponse.ok) {
      throw new Error(`Lookup by barcode failed: ${JSON.stringify(lookupBarcodePayload)}`);
    }

    const lookupSkuResponse = await fetch(
      `${baseUrl}/pos/products/lookup?sku=${encodeURIComponent(`SKU-${suffix}`)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    const lookupSkuPayload = await readJson(lookupSkuResponse);
    if (!lookupSkuResponse.ok) {
      throw new Error(`Lookup by sku failed: ${JSON.stringify(lookupSkuPayload)}`);
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
          created: createPayload,
          listedCount: listPayload.meta?.count,
          listedItems: listPayload.items,
          lookupByBarcode: lookupBarcodePayload,
          lookupBySku: lookupSkuPayload
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
