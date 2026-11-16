import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";

export type RopaCategoryNode = { id: number; key: string; label: string; subcategories: Array<{ id: number; key: string; label: string }> };

type CategoryRow = RowDataPacket & { id: number; parent_id: number | null; slug: string; label: string; position: number };

// Lista de la clienta (16/11/2026) que arrancaba fija en el frontend: se carga
// una sola vez si la tabla esta vacia, asi lo que ya hay sigue igual.
const DEFAULT_TREE: Array<{ key: string; label: string; subs: Array<[string, string]> }> = [
  { key: "accesorios", label: "Accesorios", subs: [["pulseras-infantiles", "Pulseras infantiles"], ["pulseras-perlas", "Pulseras de perlas"], ["pulseras-tejidas", "Pulseras tejidas"], ["pulseras-compartir", "Pulseras para compartir"], ["pulseras-buzios", "Pulseras de búzios"], ["chokers-buzios", "Chokers de búzios"], ["chokers-perlas", "Chokers de perlas"], ["chokers-hombres", "Chokers para hombres"]] },
  { key: "bebes", label: "Bebés y bautismos", subs: [["chupeteros", "Chupeteros"], ["recuerdo-bautismo", "Recuerdo de bautismo"], ["souvenir", "Souvenirs"]] },
  { key: "escolar", label: "Escolar", subs: [["etiquetas-cuadernos", "Etiquetas para cuadernos"], ["etiquetas-lapices", "Etiquetas para lápices"], ["tablas-multiplicar", "Tablas de multiplicar"], ["calculadoras", "Calculadoras"], ["suma-resta", "Suma y resta"]] },
  { key: "fiestas", label: "Fiestas y celebraciones", subs: [["decoracion-tortas", "Decoración para tortas"]] },
  { key: "regalos", label: "Regalos y fechas especiales", subs: [["dia-madre", "Día de la madre"], ["dia-padre", "Día del padre"], ["dia-nino", "Día del niño"], ["dia-maestro", "Día del maestro"], ["san-valentin", "San Valentín"]] },
  { key: "verano", label: "Verano", subs: [["pulseras-tejidas", "Pulseras tejidas"], ["chokers", "Chokers"], ["correa-lentes", "Correa de lentes"]] }
];

// "Pulseras de búzios" -> "pulseras-de-buzios". Es la clave que se guarda en
// los productos: se genera una vez y no se cambia nunca.
export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

@Injectable()
export class RopaCategoriesService {
  private seeded: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  private ensureSeeded(): Promise<void> {
    if (!this.seeded) {
      this.seeded = (async () => {
        await this.databaseService.execute(`CREATE TABLE IF NOT EXISTS saas_ropa_categories (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, parent_id INT UNSIGNED NULL, slug VARCHAR(80) NOT NULL, label VARCHAR(120) NOT NULL,
          position INT UNSIGNED NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_ropa_categories_parent_slug (parent_id, slug), KEY idx_ropa_categories_parent (parent_id, position)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        const count = await this.databaseService.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM saas_ropa_categories`);
        if (Number(count[0]?.total ?? 0) > 0) return;
        let position = 0;
        for (const genre of DEFAULT_TREE) {
          const result = await this.databaseService.execute<ResultSetHeader>(
            `INSERT INTO saas_ropa_categories (parent_id, slug, label, position) VALUES (NULL, ?, ?, ?)`,
            [genre.key, genre.label, position++]
          );
          let subPosition = 0;
          for (const [slug, label] of genre.subs) {
            await this.databaseService.execute(`INSERT INTO saas_ropa_categories (parent_id, slug, label, position) VALUES (?, ?, ?, ?)`, [
              result.insertId,
              slug,
              label,
              subPosition++
            ]);
          }
        }
      })().catch((error) => {
        this.seeded = null;
        throw error;
      });
    }
    return this.seeded;
  }

  async list(): Promise<{ items: RopaCategoryNode[] }> {
    await this.ensureSeeded();
    const rows = await this.databaseService.query<CategoryRow[]>(
      `SELECT id, parent_id, slug, label, position FROM saas_ropa_categories ORDER BY position ASC, id ASC`
    );
    const parents = rows.filter((row) => row.parent_id === null);
    return {
      items: parents.map((parent) => ({
        id: parent.id,
        key: parent.slug,
        label: parent.label,
        subcategories: rows.filter((row) => row.parent_id === parent.id).map((sub) => ({ id: sub.id, key: sub.slug, label: sub.label }))
      }))
    };
  }

  private async getOrThrow(id: number): Promise<CategoryRow> {
    const rows = await this.databaseService.query<CategoryRow[]>(
      `SELECT id, parent_id, slug, label, position FROM saas_ropa_categories WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows[0]) throw new NotFoundException("Categoría no encontrada.");
    return rows[0];
  }

  // Valor que los productos guardan: "categoria" o "categoria:subcategoria".
  private async productValue(row: CategoryRow): Promise<string> {
    if (row.parent_id === null) return row.slug;
    const parent = await this.getOrThrow(row.parent_id);
    return `${parent.slug}:${row.slug}`;
  }

  private async countProductsUsing(row: CategoryRow): Promise<number> {
    const value = await this.productValue(row);
    const rows = await this.databaseService.query<(RowDataPacket & { total: number })[]>(
      row.parent_id === null
        ? `SELECT COUNT(*) AS total FROM saas_ropa_products WHERE category = ? OR category LIKE ?`
        : `SELECT COUNT(*) AS total FROM saas_ropa_products WHERE category = ?`,
      row.parent_id === null ? [value, `${value}:%`] : [value]
    );
    return Number(rows[0]?.total ?? 0);
  }

  async create(label: string, parentId?: number) {
    await this.ensureSeeded();
    const cleanLabel = label.replace(/\s+/g, " ").trim();
    if (cleanLabel.length < 2) throw new BadRequestException("Poné un nombre para la categoría.");
    if (parentId !== undefined) {
      const parent = await this.getOrThrow(parentId);
      if (parent.parent_id !== null) throw new BadRequestException("Una subcategoría no puede tener otras adentro.");
    }
    const base = slugify(cleanLabel) || "categoria";
    const siblings = await this.databaseService.query<CategoryRow[]>(
      parentId === undefined
        ? `SELECT id, parent_id, slug, label, position FROM saas_ropa_categories WHERE parent_id IS NULL`
        : `SELECT id, parent_id, slug, label, position FROM saas_ropa_categories WHERE parent_id = ?`,
      parentId === undefined ? [] : [parentId]
    );
    if (siblings.some((row) => row.label.toLowerCase() === cleanLabel.toLowerCase())) {
      throw new ConflictException("Ya existe una con ese nombre.");
    }
    let slug = base;
    for (let n = 2; siblings.some((row) => row.slug === slug); n++) slug = `${base}-${n}`;
    const position = siblings.reduce((max, row) => Math.max(max, row.position), -1) + 1;
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_ropa_categories (parent_id, slug, label, position) VALUES (?, ?, ?, ?)`,
      [parentId ?? null, slug, cleanLabel, position]
    );
    return { id: result.insertId, key: slug, label: cleanLabel };
  }

  // Cambia SOLO el nombre visible: la clave guardada en los productos no se toca.
  async rename(id: number, label: string) {
    const row = await this.getOrThrow(id);
    const cleanLabel = label.replace(/\s+/g, " ").trim();
    if (cleanLabel.length < 2) throw new BadRequestException("Poné un nombre para la categoría.");
    const clash = await this.databaseService.query<RowDataPacket[]>(
      `SELECT id FROM saas_ropa_categories WHERE id <> ? AND ${row.parent_id === null ? "parent_id IS NULL" : "parent_id = ?"} AND LOWER(label) = LOWER(?) LIMIT 1`,
      row.parent_id === null ? [id, cleanLabel] : [id, row.parent_id, cleanLabel]
    );
    if (clash[0]) throw new ConflictException("Ya existe una con ese nombre.");
    await this.databaseService.execute(`UPDATE saas_ropa_categories SET label = ? WHERE id = ?`, [cleanLabel, id]);
    return { before: row.label, after: cleanLabel };
  }

  async move(id: number, direction: "up" | "down") {
    const row = await this.getOrThrow(id);
    const siblings = await this.databaseService.query<CategoryRow[]>(
      row.parent_id === null
        ? `SELECT id, parent_id, slug, label, position FROM saas_ropa_categories WHERE parent_id IS NULL ORDER BY position ASC, id ASC`
        : `SELECT id, parent_id, slug, label, position FROM saas_ropa_categories WHERE parent_id = ? ORDER BY position ASC, id ASC`,
      row.parent_id === null ? [] : [row.parent_id]
    );
    const index = siblings.findIndex((item) => item.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) return { ok: true };
    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    for (let position = 0; position < reordered.length; position++) {
      await this.databaseService.execute(`UPDATE saas_ropa_categories SET position = ? WHERE id = ?`, [position, reordered[position].id]);
    }
    return { ok: true };
  }

  // No se puede borrar algo que todavia tiene productos: se pediria perder la
  // categoria de esos productos sin querer. Primero se les cambia la categoria.
  async remove(id: number) {
    const row = await this.getOrThrow(id);
    const used = await this.countProductsUsing(row);
    if (used > 0) {
      throw new ConflictException(
        `Tiene ${used} ${used === 1 ? "producto" : "productos"}. Cambiales la categoría antes de borrarla.`
      );
    }
    await this.databaseService.execute(`DELETE FROM saas_ropa_categories WHERE id = ? OR parent_id = ?`, [id, id]);
    return { ok: true, label: row.label };
  }
}
