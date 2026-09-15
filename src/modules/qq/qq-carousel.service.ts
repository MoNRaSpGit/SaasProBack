import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

type QqCarouselImageRow = RowDataPacket & {
  id: number;
  mime_type: string;
  source_hash: string;
  created_at: string;
};

type QqCarouselImageBinaryRow = RowDataPacket & {
  image_data: Buffer;
  mime_type: string;
  source_hash: string;
};

export type QqCarouselImage = {
  id: number;
  createdAt: string;
};

// data:<mime>;base64,<payload> -- mismo criterio que qq-products.service.ts
// (la imagen ya llega redimensionada/comprimida del lado del cliente).
function parseImageDataUri(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

const CAROUSEL_COLUMNS = `
  id, mime_type, source_hash,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') AS created_at
`;

@Injectable()
export class QqCarouselService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Lista publica: solo metadata (id, fecha), nunca el binario -- el
  // fondo de cada una se pide aparte via getCarouselImage.
  async listImages(): Promise<{ items: QqCarouselImage[] }> {
    const rows = await this.databaseService.query<QqCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_qq_carousel_images ORDER BY sort_order ASC, created_at ASC`
    );
    return { items: rows.map((row) => ({ id: row.id, createdAt: row.created_at })) };
  }

  async getCarouselImage(imageId: number): Promise<{ buffer: Buffer; mimeType: string; sourceHash: string } | null> {
    const rows = await this.databaseService.query<QqCarouselImageBinaryRow[]>(
      `SELECT image_data, mime_type, source_hash FROM saas_qq_carousel_images WHERE id = ? LIMIT 1`,
      [imageId]
    );
    if (!rows[0]) return null;
    return { buffer: rows[0].image_data, mimeType: rows[0].mime_type, sourceHash: rows[0].source_hash };
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

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_qq_carousel_images (image_data, mime_type, source_hash, byte_size, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [parsed.buffer, parsed.mimeType, sourceHash, parsed.buffer.length, nextOrder]
    );

    const rows = await this.databaseService.query<QqCarouselImageRow[]>(
      `SELECT ${CAROUSEL_COLUMNS} FROM saas_qq_carousel_images WHERE id = ? LIMIT 1`,
      [result.insertId]
    );
    return { item: { id: rows[0].id, createdAt: rows[0].created_at } };
  }

  async deleteImage(imageId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_qq_carousel_images WHERE id = ?`,
      [imageId]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundException("Imagen no encontrada");
    }
    return { ok: true };
  }
}
