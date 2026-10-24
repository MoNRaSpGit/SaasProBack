import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import type { CreatePilotoProductDto } from "./dto/create-piloto-product.dto";
import { PilotoService } from "./piloto.service";
import type { PilotoProduct } from "./piloto.types";

// Pestaña "Tickets" del Modo Pro (24/10/2026, pedido explicito): codigos
// de barras inventados para lo que se vende suelto (ej. "202020
// Empanada $50"), impresos en la tiquetera. Cada ticket es un producto
// comun (el lector lo encuentra con la busqueda de siempre); la tabla
// saas_piloto_ticket_products solo marca cuales son tickets. Para editar
// nombre/precio se usa el PATCH de productos de siempre.
@Injectable()
export class PilotoTicketsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pilotoService: PilotoService
  ) {}

  async listTickets(): Promise<{ items: PilotoProduct[] }> {
    const rows = await this.databaseService.query<(RowDataPacket & { product_id: number })[]>(
      `SELECT t.product_id
       FROM saas_piloto_ticket_products t
       JOIN saas_piloto_products p ON p.id = t.product_id
       ORDER BY p.name ASC`
    );
    const items = await Promise.all(rows.map(async (row) => (await this.pilotoService.getProductOrThrow(row.product_id)).item));
    return { items };
  }

  async createTicket(dto: CreatePilotoProductDto): Promise<{ item: PilotoProduct }> {
    const result = await this.pilotoService.createProduct(dto);
    await this.databaseService.execute(`INSERT INTO saas_piloto_ticket_products (product_id) VALUES (?)`, [result.item.id]);
    return result;
  }
}
