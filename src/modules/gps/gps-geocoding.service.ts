import { Injectable, Logger } from "@nestjs/common";

// Ubicar una direccion de Tacuarembo en el mapa (27/10/2026, para "Agregar
// cliente" a mano). Usa el geocodificador oficial de Uruguay (IDE,
// direcciones.ide.uy): gratis, con numeracion por puerta, y NO gasta cupo
// de OpenRouteService. Misma logica con la que se importaron los clientes
// del listado (ver memoria del proyecto GPS).
const IDE_BASE = "https://direcciones.ide.uy/api/v1/geocode/";
const LOCALITY = "TACUAREMBO";

export type GpsGeocodeQuality = "puerta" | "esquina" | "calle";
export type GpsGeocodeResult = { found: true; lat: number; lng: number; quality: GpsGeocodeQuality; matched: string } | { found: false };

type IdeCandidate = { type: string; idCalle: number; nomVia: string; localidad: string; address: string };
type IdePoint = { lat: number; lng: number; address: string };

type ParsedAddress =
  | { kind: "portal"; street: string; number: number }
  | { kind: "esquina"; street: string; corner: string }
  | { kind: "calle"; street: string };

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Abreviaturas comunes del listado de clientes ("A.v", "Dr.", "Gral",
// "L. Seregni"...) y los numeros que son calles ("33", "25", "18").
function cleanStreet(raw: string) {
  let text = ` ${raw.trim()} `;
  text = text.replace(/\(.*?\)/g, " ");
  text = text.replace(/\bA\.\s?v\.?\s*/gi, "avenida ").replace(/\bAv\.?\s+/gi, "avenida ");
  text = text.replace(/\b(Dct|Dr|Doctor)\.?\s*/gi, "doctor ").replace(/\b(Gral|Grl|Gnrl|Geral)\.*\s*/gi, "general ");
  text = text.replace(/\bL\.\s*Seregni/gi, "liber seregni").replace(/\bW\.\s*/gi, "wilson ").replace(/\bPbro\.?\s*/gi, "presbitero ");
  text = text.replace(/\s+/g, " ").trim();
  const bare = normalize(text).replace(/[^a-z0-9 ]/g, "").trim();
  if (bare === "33" || bare === "treinta y tres") return "treinta y tres";
  if (bare === "25") return "25 de mayo";
  if (bare === "18") return "18 de julio";
  return text;
}

// El IDE a veces devuelve OTRA calle parecida ("Calle que no existe" ->
// "Calle 247", "Av. Oribe" -> "Av. Oliver"): se acepta solo si alguna
// palabra de la calle escrita coincide con la encontrada.
const STOP_WORDS = new Set(["avenida", "doctor", "general", "calle", "de", "del", "la", "las", "los", "y", "esq", "esquina", "presbitero", "que", "no"]);
function streetWords(text: string) {
  const plain = normalize(text).replace(/[^a-z0-9 ]/g, " ");
  const words = plain.split(/\s+/).filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
  if (/(^|\s)(33|treinta y tres)(\s|$)/.test(plain)) words.push("orientales");
  if (/(^|\s)18(\s|$)/.test(plain)) words.push("julio");
  if (/(^|\s)25(\s|$)/.test(plain)) words.push("mayo");
  return words;
}
function wordsNear(a: string, b: string) {
  return a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
}
function streetMatches(written: string, found: string) {
  const writtenWords = streetWords(written);
  const foundWords = streetWords(found);
  return writtenWords.length > 0 && writtenWords.some((word) => foundWords.some((other) => wordsNear(word, other)));
}

function parseAddress(address: string): ParsedAddress {
  const text = address
    .replace(/\s+/g, " ")
    .replace(/,?\s*tacuaremb[oó]\s*$/i, "")
    .replace(/\b(n[°ºo]?|nro|numero|número)\.?\s*(?=\d)/gi, "")
    .trim();
  const parts = text
    .split(/\s*(?:\/|\besq(?:uina)?\b\.*|\by\b|\bentre\b|\bcasi\b|,)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const first = parts[0] ?? "";
  const withNumber = first.match(/^(.*?[a-záéíóúñ.].*?)\s+(\d{1,5})(?:\s|$)/i) || first.match(/^(\d{1,2}|treinta y tres)\s+(\d{2,5})$/i);
  if (withNumber) return { kind: "portal", street: cleanStreet(withNumber[1]), number: Number(withNumber[2]) };
  if (parts.length >= 2) return { kind: "esquina", street: cleanStreet(parts[0]), corner: cleanStreet(parts[1]) };
  return { kind: "calle", street: cleanStreet(first) };
}

@Injectable()
export class GpsGeocodingService {
  private readonly logger = new Logger(GpsGeocodingService.name);

  async geocode(address: string): Promise<GpsGeocodeResult> {
    const parsed = parseAddress(address);
    if (!parsed.street) return { found: false };
    try {
      if (parsed.kind === "portal") {
        const candidates = await this.get<IdeCandidate[]>("candidates", { q: `${parsed.street} ${parsed.number}, tacuarembo`, limit: "6" });
        const candidate = candidates.find(
          (entry) => entry.localidad === LOCALITY && entry.type === "CALLEyPORTAL" && streetMatches(parsed.street, entry.nomVia)
        );
        if (candidate) {
          const door = await this.firstPoint({ type: "CALLEyPORTAL", idcalle: String(candidate.idCalle), portal: String(parsed.number) });
          if (door) return { found: true, lat: door.lat, lng: door.lng, quality: "puerta", matched: door.address };
          const street = await this.firstPoint({ type: "CALLE", idcalle: String(candidate.idCalle) });
          if (street) return { found: true, lat: street.lat, lng: street.lng, quality: "calle", matched: `${candidate.nomVia} (sin el número exacto)` };
        }
        return { found: false };
      }

      const street = await this.findStreet(parsed.street);
      if (!street) return { found: false };
      if (parsed.kind === "esquina") {
        const corner = await this.findStreet(parsed.corner);
        if (corner) {
          const point = await this.firstPoint({ type: "ESQUINA", idcalle: String(street.idCalle), idcalleEsq: String(corner.idCalle) });
          if (point) return { found: true, lat: point.lat, lng: point.lng, quality: "esquina", matched: point.address.replace(/, TACUAREMBO, TACUAREMBO$/, "") };
        }
      }
      const point = await this.firstPoint({ type: "CALLE", idcalle: String(street.idCalle) });
      return point ? { found: true, lat: point.lat, lng: point.lng, quality: "calle", matched: `${street.nomVia} (aproximada)` } : { found: false };
    } catch (error) {
      this.logger.warn(`Geocodificador IDE fallo: ${(error as Error).message}`);
      return { found: false };
    }
  }

  private async findStreet(street: string) {
    const candidates = await this.get<IdeCandidate[]>("candidates", { q: `${street}, tacuarembo`, limit: "6" });
    return candidates.find(
      (entry) => entry.localidad === LOCALITY && (entry.type === "CALLE" || entry.type === "CALLEyPORTAL") && streetMatches(street, entry.nomVia)
    );
  }

  private async firstPoint(params: Record<string, string>): Promise<IdePoint | null> {
    const points = await this.get<IdePoint[]>("find", params);
    return points.find((point) => point.lat && point.lng) ?? null;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const response = await fetch(`${IDE_BASE}${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`IDE ${path} respondio ${response.status}`);
    const data = (await response.json()) as unknown;
    return (Array.isArray(data) ? data : []) as T;
  }
}
