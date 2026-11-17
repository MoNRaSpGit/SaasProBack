import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { CloudinaryService } from "../../shared/cloudinary/cloudinary.service";
import { DatabaseService } from "../../shared/database/database.service";

type QqCarouselImageRow = RowDataPacket & {
  id: number;
  mime_type: string;
  source_hash: string;
  desktop_source_hash: string | null;
  image_url: string | null;
  desktop_image_url: string | null;
  created_at: string;
};

type QqCarouselImageBinaryRow = RowDataPacket & {
  image_data: Buffer | null;
  mime_type: string;
  source_hash: string;
  image_url: string | null;
};

type QqCarouselPublicIdsRow = RowDataPacket & {
  image_public_id: string | null;
  desktop_image_public_id: string | null;
};

// version: primeros 12 caracteres del hash del binario. El frontend la agrega
// a la URL de la imagen (?v=...) cuando la sirve el backend (imagenes viejas,
// guardadas en la base).
// imageUrl / desktopImageUrl (17/11/2026): link directo de Cloudinary. Si
// existe, el frontend lo usa tal cual y no pasa por el backend.
// desktopVersion: null = no tiene version PC (la PC usa la de celular).
export type QqCarouselImage = {
  id: number;
  createdAt: string;
  version: string;
  desktopVersion: string | null;
  imageUrl: string | null;
  desktopImageUrl: string | null;
};

export type QqCarouselVariant = "mobile" | "desktop";

function toCarouselImage(row: QqCarouselImageRow): QqCarouselImage {
  return {
    id: row.id,
    createdAt: row.created_at,
    version: row.source_hash.slice(0, 12),
    desktopVersion: row.desktop_source_hash ? row.desktop_source_hash.slice(0, 12) : null,
    imageUrl: row.image_url,
    desktopImageUrl: row.desktop_image_url
  };
}

// data:<mime>;base64,<payload> -- mismo criterio que qq-products.service.ts
// (la imagen ya llega redimensionada/comprimida del lado del cliente).
function parseImageDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  // Solo imagenes raster: nada de "text/html" o "image/svg+xml".
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

const CAROUSEL_COLUMNS = `
  id, mime_type, source_hash, desktop_source_hash, image_url, desktop_image_url,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

const CLOUDINARY_FOLDER = "qq/carousel";

@Injectable()
export class QqCarouselService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  // Lista publica: solo metadata y links, nunca el binario.
  async listImages(): Promise<{ items: QqCarouselImage[] }> {
    const rows = await this.databaseService.query<QqCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_qq_carousel_images ORDER BY sort_order ASC, created_at ASC`
    );
    return { items: rows.map(toCarouselImage) };
  }

  // Las imagenes nuevas viven en Cloudinary (se devuelve el link para que el
  // controller haga un redirect); las viejas, guardadas en la base, se siguen
  // sirviendo en binario.
  async getCarouselImage(
    imageId: number,
    variant: QqCarouselVariant = "mobile"
  ): Promise<{ cloudinaryUrl: string } | { buffer: Buffer; mimeType: string; sourceHash: string } | null> {
    // Columnas fijas segun variante (nunca texto del request en el SQL).
    const sql =
      variant === "desktop"
        ? `SELECT desktop_image_data AS image_data, desktop_mime_type AS mime_type, desktop_source_hash AS source_hash, desktop_image_url AS image_url
           FROM saas_qq_carousel_images WHERE id = ? AND (desktop_image_data IS NOT NULL OR desktop_image_url IS NOT NULL) LIMIT 1`
        : `SELECT image_data, mime_type, source_hash, image_url FROM saas_qq_carousel_images WHERE id = ? LIMIT 1`;
    const rows = await this.databaseService.query<QqCarouselImageBinaryRow[]>(sql, [imageId]);
    const row = rows[0];
    if (!row) return null;
    if (row.image_url) return { cloudinaryUrl: row.image_url };
    if (!row.image_data) return null;
    return { buffer: row.image_data, mimeType: row.mime_type, sourceHash: row.source_hash };
  }

  private newPublicId(prefix: string): string {
    return `${prefix}-${randomBytes(6).toString("hex")}`;
  }

  async addImage(dataUri: string): Promise<{ item: QqCarouselImage }> {
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 válido.");
    }

    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");
    const [{ nextOrder }] = await this.databaseService.query<Array<RowDataPacket & { nextOrder: number }>>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM saas_qq_carousel_images`
    );

    let insertId: number;
    if (this.cloudinaryService.isConfigured()) {
      const upload = await this.cloudinaryService.uploadBuffer(parsed.buffer, CLOUDINARY_FOLDER, this.newPublicId("carousel"));
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_qq_carousel_images (image_data, mime_type, source_hash, byte_size, sort_order, image_url, image_public_id)
         VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
        [parsed.mimeType, sourceHash, parsed.buffer.length, nextOrder, this.cloudinaryService.optimizedUrl(upload.url), upload.publicId]
      );
      insertId = result.insertId;
    } else {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_qq_carousel_images (image_data, mime_type, source_hash, byte_size, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [parsed.buffer, parsed.mimeType, sourceHash, parsed.buffer.length, nextOrder]
      );
      insertId = result.insertId;
    }

    const rows = await this.databaseService.query<QqCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_qq_carousel_images WHERE id = ? LIMIT 1`,
      [insertId]
    );
    return { item: toCarouselImage(rows[0]) };
  }

  // Pone o reemplaza la version PC de una imagen ya cargada.
  async setDesktopImage(imageId: number, dataUri: string): Promise<{ item: QqCarouselImage }> {
    const parsed = parseImageDataUri(dataUri);
    if (!parsed) {
      throw new BadRequestException("La imagen debe ser un data URI base64 válido.");
    }
    const existing = await this.databaseService.query<QqCarouselPublicIdsRow[]>(
      `SELECT image_public_id, desktop_image_public_id FROM saas_qq_carousel_images WHERE id = ? LIMIT 1`,
      [imageId]
    );
    if (!existing[0]) {
      throw new NotFoundException("Imagen no encontrada");
    }

    const sourceHash = createHash("sha256").update(parsed.buffer).digest("hex");
    if (this.cloudinaryService.isConfigured()) {
      const upload = await this.cloudinaryService.uploadBuffer(parsed.buffer, CLOUDINARY_FOLDER, this.newPublicId("carousel-pc"));
      await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_qq_carousel_images
         SET desktop_image_data = NULL, desktop_mime_type = ?, desktop_source_hash = ?, desktop_image_url = ?, desktop_image_public_id = ?
         WHERE id = ?`,
        [parsed.mimeType, sourceHash, this.cloudinaryService.optimizedUrl(upload.url), upload.publicId, imageId]
      );
      // La version PC anterior (si habia) se borra de Cloudinary.
      if (existing[0].desktop_image_public_id) {
        await this.cloudinaryService.deleteByPublicId(existing[0].desktop_image_public_id).catch(() => undefined);
      }
    } else {
      await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_qq_carousel_images
         SET desktop_image_data = ?, desktop_mime_type = ?, desktop_source_hash = ?, desktop_image_url = NULL, desktop_image_public_id = NULL
         WHERE id = ?`,
        [parsed.buffer, parsed.mimeType, sourceHash, imageId]
      );
    }

    const rows = await this.databaseService.query<QqCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_qq_carousel_images WHERE id = ? LIMIT 1`,
      [imageId]
    );
    return { item: toCarouselImage(rows[0]) };
  }

  async deleteImage(imageId: number): Promise<{ ok: true }> {
    const existing = await this.databaseService.query<QqCarouselPublicIdsRow[]>(
      `SELECT image_public_id, desktop_image_public_id FROM saas_qq_carousel_images WHERE id = ? LIMIT 1`,
      [imageId]
    );
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_qq_carousel_images WHERE id = ?`,
      [imageId]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundException("Imagen no encontrada");
    }
    // Tambien se borran de Cloudinary (si no estaban, no pasa nada).
    for (const publicId of [existing[0]?.image_public_id, existing[0]?.desktop_image_public_id]) {
      if (publicId) await this.cloudinaryService.deleteByPublicId(publicId).catch(() => undefined);
    }
    return { ok: true };
  }
}
