// Tipos que reflejan el esquema real de la API de facturaelectronica.com.uy
// (FEU), segun su documentacion publica: https://ayuda.facturaelectronica.com.uy/ayuda/api-de-factura-electronica-uruguay/

export type DgiTipoDocumento = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type DgiIndicadorFacturacion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type DgiFeuTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token?: string;
};

export type DgiFeuClienteRequest = {
  tipo_doc: DgiTipoDocumento;
  cod_pais_doc: string;
  nro_doc: string;
  denominacion: string;
  correo_electronico?: string;
  direccion?: string;
  ciudad?: string;
  dep_prov_estado?: string;
  pais?: string;
  cp?: number;
  informacion_adicional?: string;
  identificacion_compra?: string;
  destino?: string;
};

export type DgiFeuItemRequest = {
  cantidad: number;
  concepto: string;
  precio: number;
  unidad: string;
  indicador_facturacion: DgiIndicadorFacturacion;
  descuento?: number;
  recargo?: number;
  descuento_mnt?: number;
  recargo_mnt?: number;
};

export type DgiFeuMedioPagoRequest = {
  codigo?: number;
  glosa?: string;
  valor?: number;
};

export type DgiFeuComprobanteRequest = {
  sucursal: number;
  tipo_comprobante: number;
  forma_pago?: number;
  moneda: string;
  tipo_cambio?: number;
  cod_montos_brutos?: number;
  fecha_comprobante?: string;
  fecha_vencimiento?: string;
  cliente?: DgiFeuClienteRequest;
  id_externo?: string;
  items: DgiFeuItemRequest[];
  informacion_adicional?: string;
  medio_pago?: DgiFeuMedioPagoRequest[];
};

export type DgiFeuComprobanteResponse = {
  id: number;
  comprobante_tipo: number;
  serie: string;
  numero: number;
  importe_total: number;
  hash: string;
  cae_numero: number;
  cae_rango_inicio: number;
  cae_rango_final: number;
  cae_vencimiento: string;
  url: string;
};

export type DgiFeuPdfFormat = "A4" | "ticket80";

// GET /comprobantes/{id}/pdf devuelve el PDF envuelto en JSON (no binario
// directo), con los bytes en base64.
export type DgiFeuPdfResponse = {
  file_name: string;
  mime_type: string;
  format: "base64";
  data: string;
};
