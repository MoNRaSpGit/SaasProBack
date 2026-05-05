export const SAAS_PRODUCT_KEYS = ["camiones", "distribuidora", "pos"] as const;

export type SaasProductKey = (typeof SAAS_PRODUCT_KEYS)[number];

export type SaasProductDescriptor = {
  key: SaasProductKey;
  label: string;
  frontend: string;
};

export const SAAS_PRODUCTS: Record<SaasProductKey, SaasProductDescriptor> = {
  camiones: {
    key: "camiones",
    label: "Camiones",
    frontend: "frontend-camiones"
  },
  distribuidora: {
    key: "distribuidora",
    label: "Distribuidora",
    frontend: "frontend-distribuidora"
  },
  pos: {
    key: "pos",
    label: "POS",
    frontend: "frontend-pos"
  }
};

export const SAAS_PRODUCT_FRONTENDS: Record<SaasProductKey, string> = {
  camiones: SAAS_PRODUCTS.camiones.frontend,
  distribuidora: SAAS_PRODUCTS.distribuidora.frontend,
  pos: SAAS_PRODUCTS.pos.frontend
};

export function isSaasProductKey(value: string): value is SaasProductKey {
  return SAAS_PRODUCT_KEYS.includes(value as SaasProductKey);
}

export function getSaasProductDescriptor(value: string) {
  return isSaasProductKey(value) ? SAAS_PRODUCTS[value] : null;
}

export function buildEnabledProductDescriptors(moduleKeys: string[]) {
  return moduleKeys
    .map((moduleKey) => getSaasProductDescriptor(moduleKey))
    .filter((product): product is SaasProductDescriptor => Boolean(product));
}
