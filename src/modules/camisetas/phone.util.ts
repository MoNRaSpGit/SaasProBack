// Celulares uruguayos: 9 digitos, empiezan con "09" (ej 092945696). Acepta
// que lo escriban con espacios/guiones o con +598 adelante y lo normaliza
// a un unico formato antes de guardarlo.
const UY_MOBILE_REGEX = /^09\d{7}$/;

export function normalizeUyPhone(raw: string): string {
  let digits = raw.trim().replace(/[^\d+]/g, "");
  digits = digits.replace(/^\+/, "");

  if (digits.startsWith("598")) {
    digits = `0${digits.slice(3)}`;
  } else if (!digits.startsWith("0")) {
    digits = `0${digits}`;
  }

  return digits;
}

export function isValidUyMobile(raw: string): boolean {
  return UY_MOBILE_REGEX.test(normalizeUyPhone(raw));
}
