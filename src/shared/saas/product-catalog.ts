export const SAAS_PRODUCT_KEYS = ["camiones", "agro", "alamcen"] as const;

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
  agro: {
    key: "agro",
    label: "Agro",
    frontend: "frontend-agro"
  },
  alamcen: {
    key: "alamcen",
    label: "Almacen",
    frontend: "frontend-alamcen"
  }
};

export const SAAS_PRODUCT_FRONTENDS: Record<SaasProductKey, string> = {
  camiones: SAAS_PRODUCTS.camiones.frontend,
  agro: SAAS_PRODUCTS.agro.frontend,
  alamcen: SAAS_PRODUCTS.alamcen.frontend
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
