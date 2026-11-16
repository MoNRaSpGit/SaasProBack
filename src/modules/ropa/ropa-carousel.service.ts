import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

type RopaCarouselImageRow = RowDataPacket & {
  id: number;
  mime_type: string;
  source_hash: string;
  desktop_source_hash: string | null;
  created_at: string;
};

type RopaCarouselImageBinaryRow = RowDataPacket & {
  image_data: Buffer;
  mime_type: string;
  source_hash: string;
};

// version: primeros 12 caracteres del hash del binario. El frontend la agrega
// a la URL de la imagen (?v=...) porque el endpoint la sirve con
// "Cache-Control: immutable" por un anio: si se reemplaza el contenido de una
// imagen (mismo id), sin esto los navegadores que ya la tenian seguian
// mostrando la vieja (solo se veia bien en incognito).
// desktopVersion: null = no tiene version PC (la PC usa la de celular).
export type RopaCarouselImage = {
  id: number;
  createdAt: string;
  version: string;
  desktopVersion: string | null;
};

export type RopaCarouselVariant = "mobile" | "desktop";

function toCarouselImage(row: RopaCarouselImageRow): RopaCarouselImage {
  return {
    id: row.id,
    createdAt: row.created_at,
    version: row.source_hash.slice(0, 12),
    desktopVersion: row.desktop_source_hash ? row.desktop_source_hash.slice(0, 12) : null
  };
}

// data:<mime>;base64,<payload> -- mismo criterio que ropa-products.service.ts
// (la imagen ya llega redimensionada/comprimida del lado del cliente).
function parseImageDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  // Solo imagenes raster: se sirven con este mismo Content-Type, asi que un
  // "text/html" o "image/svg+xml" seria HTML/JS ejecutable en el dominio de la API.
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

const CAROUSEL_COLUMNS = `
  id, mime_type, source_hash, desktop_source_hash,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

@Injectable()
export class RopaCarouselService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Lista publica: solo metadata (id, fecha), nunca el binario -- el
  // fondo de cada una se pide aparte via getCarouselImage.
  async listImages(): Promise<{ items: RopaCarouselImage[] }> {
    const rows = await this.databaseService.query<RopaCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_ropa_carousel_images ORDER BY sort_order ASC, created_at ASC`
    );
    return { items: rows.map(toCarouselImage) };
  }

  async getCarouselImage(
    imageId: number,
    variant: RopaCarouselVariant = "mobile"
  ): Promise<{ buffer: Buffer; mimeType: string; sourceHash: string } | null> {
    // Columnas fijas segun variante (nunca texto del request en el SQL).
    const sql =
      variant === "desktop"
        ? `SELECT desktop_image_data AS image_data, desktop_mime_type AS mime_type, desktop_source_hash AS source_hash
           FROM saas_ropa_carousel_images WHERE id = ? AND desktop_image_data IS NOT NULL LIMIT 1`
        : `SELECT image_data, mime_type, source_hash FROM saas_ropa_carousel_images WHERE id = ? LIMIT 1`;
    const rows = await this.databaseService.query<RopaCarouselImageBinaryRow[]>(sql, [imageId]);
    if (!rows[0]) return null;
    return { buffer: rows[0].image_data, mimeType: rows[0].mime_type, sourceHash: rows[0].source_hash };
  }

  async addImage(dataUri: string): Promise<{ item: RopaCarouselImage }> {
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 válido.");
    }

    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");
    const [{ nextOrder }] = await this.databaseService.query<Array<RowDataPacket & { nextOrder: number }>>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM saas_ropa_carousel_images`
    );

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ropa_carousel_images (image_data, mime_type, source_hash, byte_size, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [parsed.buffer, parsed.mimeType, sourceHash, parsed.buffer.length, nextOrder]
    );

    const rows = await this.databaseService.query<RopaCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_ropa_carousel_images WHERE id = ? LIMIT 1`,
      [result.insertId]
    );
    return { item: toCarouselImage(rows[0]) };
  }

  // Pone o reemplaza la version PC de una imagen ya cargada.
  async setDesktopImage(imageId: number, dataUri: string): Promise<{ item: RopaCarouselImage }> {
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 válido.");
    }
    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");
    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_ropa_carousel_images
       SET desktop_image_data = ?, desktop_mime_type = ?, desktop_source_hash = ?
       WHERE id = ?`,
      [parsed.buffer, parsed.mimeType, sourceHash, imageId]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundException("Imagen no encontrada");
    }
    const rows = await this.databaseService.query<RopaCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_ropa_carousel_images WHERE id = ? LIMIT 1`,
      [imageId]
    );
    return { item: toCarouselImage(rows[0]) };
  }

  async deleteImage(imageId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_ropa_carousel_images WHERE id = ?`,
      [imageId]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundException("Imagen no encontrada");
    }
    return { ok: true };
  }
}
