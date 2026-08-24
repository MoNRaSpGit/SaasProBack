import { BadGatewayException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateDgiComprobanteDto } from "./dto/create-dgi-comprobante.dto";
import { DgiFeuComprobanteRequest, DgiFeuComprobanteResponse, DgiFeuTokenResponse } from "./dgi.types";

// Cliente contra la API de facturaelectronica.com.uy (FEU). Todo lo
// referido a "test" pega contra su ambiente de sandbox
// (auth-test.facturaelectronica.com.uy / api-test.facturaelectronica.com.uy);
// para pasar a produccion solo hace falta cambiar DGI_FEU_ENVIRONMENT=production
// y completar las URLs/credenciales reales del cliente en las variables
// DGI_FEU_*_PROD (todavia no confirmadas: FEU no publica esas URLs hasta
// que uno es cliente).
const DEFAULT_TEST_AUTH_URL = "https://auth-test.facturaelectronica.com.uy/token";
const DEFAULT_TEST_API_URL = "https://api-test.facturaelectronica.com.uy";

// e-Ticket: el tipo de comprobante mas simple para probar (no exige datos
// del cliente si el importe es bajo).
const DEFAULT_TIPO_COMPROBANTE = 101;
const DEFAULT_MONEDA = "UYU";

// El token dura ~1h segun el flujo OAuth2 estandar que documenta FEU; se
// renueva un poco antes para no arriesgarse a que expire a mitad de un
// pedido.
const TOKEN_TTL_MS = 50 * 60 * 1000;

type CachedToken = {
  accessToken: string;
  refreshToken?: string;
  obtainedAt: number;
};

@Injectable()
export class DgiService {
  private cachedToken: CachedToken | null = null;

  constructor(private readonly configService: ConfigService) {}

  // Endpoint liviano solo para confirmar que las credenciales andan y que
  // FEU responde 200 -- no crea ningun comprobante real.
  async pingSandbox() {
    const token = await this.getAccessToken(true);
    return {
      ok: true,
      environment: this.getEnvironment(),
      message: "Conexion con FEU exitosa, token obtenido correctamente.",
      tokenPreview: `${token.slice(0, 12)}...`
    };
  }

  async createComprobante(dto: CreateDgiComprobanteDto) {
    const token = await this.getAccessToken();
    const rutEmisor = this.requireEnv("DGI_FEU_RUT_EMISOR");

    const body: DgiFeuComprobanteRequest = {
      sucursal: dto.sucursal ?? Number(this.requireEnv("DGI_FEU_SUCURSAL")),
      tipo_comprobante: dto.tipoComprobante ?? DEFAULT_TIPO_COMPROBANTE,
      moneda: dto.moneda ?? DEFAULT_MONEDA,
      cliente: dto.cliente
        ? {
            tipo_doc: dto.cliente.tipoDoc,
            cod_pais_doc: dto.cliente.codPaisDoc,
            nro_doc: dto.cliente.nroDoc,
            denominacion: dto.cliente.denominacion,
            correo_electronico: dto.cliente.correoElectronico,
            direccion: dto.cliente.direccion,
            ciudad: dto.cliente.ciudad,
            cp: dto.cliente.cp
          }
        : undefined,
      items: dto.items.map((item) => ({
        cantidad: item.cantidad,
        concepto: item.concepto,
        precio: item.precio,
        unidad: item.unidad,
        indicador_facturacion: item.indicadorFacturacion,
        descuento: item.descuento,
        recargo: item.recargo
      })),
      informacion_adicional: dto.informacionAdicional
    };

    const response = await fetch(`${this.getApiUrl()}/comprobantes/crear`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Emisor": rutEmisor
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new BadGatewayException({
        message: "FEU rechazo el comprobante.",
        status: response.status,
        feuResponse: data
      });
    }

    return { ok: true, item: data as DgiFeuComprobanteResponse };
  }

  private async getAccessToken(forceRefresh = false) {
    if (!forceRefresh && this.cachedToken && Date.now() - this.cachedToken.obtainedAt < TOKEN_TTL_MS) {
      return this.cachedToken.accessToken;
    }

    const username = this.requireEnv("DGI_FEU_USERNAME");
    const password = this.requireEnv("DGI_FEU_PASSWORD");

    const response = await fetch(this.getAuthUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "password", username, password })
    });

    const data = (await response.json().catch(() => null)) as DgiFeuTokenResponse | null;

    if (!response.ok || !data?.access_token) {
      throw new BadGatewayException({
        message: "No se pudo autenticar contra FEU. Revisa DGI_FEU_USERNAME / DGI_FEU_PASSWORD.",
        status: response.status,
        feuResponse: data
      });
    }

    this.cachedToken = { accessToken: data.access_token, refreshToken: data.refresh_token, obtainedAt: Date.now() };
    return data.access_token;
  }

  private getEnvironment(): "test" | "production" {
    const raw = this.configService.get<string>("DGI_FEU_ENVIRONMENT")?.trim().toLowerCase();
    return raw === "production" ? "production" : "test";
  }

  private getAuthUrl() {
    if (this.getEnvironment() === "production") {
      return this.requireEnv("DGI_FEU_AUTH_URL_PROD");
    }
    return this.configService.get<string>("DGI_FEU_AUTH_URL_TEST")?.trim() || DEFAULT_TEST_AUTH_URL;
  }

  private getApiUrl() {
    if (this.getEnvironment() === "production") {
      return this.requireEnv("DGI_FEU_API_URL_PROD");
    }
    return this.configService.get<string>("DGI_FEU_API_URL_TEST")?.trim() || DEFAULT_TEST_API_URL;
  }

  private requireEnv(key: string) {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new BadGatewayException(`Falta configurar la variable de entorno ${key}.`);
    }
    return value;
  }
}
