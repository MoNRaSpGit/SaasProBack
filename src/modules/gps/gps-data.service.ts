import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateGpsSaleDto } from "./dto/create-gps-sale.dto";

export type GpsClient = { id: number; name: string; address: string; lat: number; lng: number };
export type GpsProduct = { id: number; name: string; price: number };
export type GpsSaleItem = { productId: number; productName: string; quantity: number; unitPrice: number };
export type GpsSale = {
  id: number;
  clientId: number;
  clientName: string;
  clientAddress: string;
  clientLat: number;
  clientLng: number;
  sellerUsername: string;
  items: GpsSaleItem[];
  total: number;
  status: "pendiente" | "entregado";
  createdAt: string;
};

type ClientRow = RowDataPacket & { id: number; name: string; address: string; lat: number; lng: number };
type ProductRow = RowDataPacket & { id: number; name: string; price: string };
type SaleRow = RowDataPacket & {
  id: number;
  client_id: number;
  client_name: string;
  client_address: string;
  client_lat: number;
  client_lng: number;
  seller_username: string;
  items_json: string;
  total: string;
  status: "pendiente" | "entregado";
  created_at: string;
};

// Clientes y productos ficticios para la demo del proyecto -- no son datos
// reales de ningun cliente. Direcciones de Montevideo con coordenadas
// aproximadas, para que el mapa de "generar ruta" tenga puntos reales donde
// dibujar.
const DEMO_CLIENTS: Array<Omit<GpsClient, "id">> = [
  { name: "Panadería La Espiga", address: "Av. 18 de Julio 1234, Centro, Montevideo", lat: -34.9058, lng: -56.1913 },
  { name: "Almacén Don Pepe", address: "Bulevar Artigas 2500, Pocitos, Montevideo", lat: -34.9115, lng: -56.157 },
  { name: "Kiosco Rayitos", address: "Av. Italia 3400, Malvín, Montevideo", lat: -34.889, lng: -56.128 },
  { name: "Farmacia Sur", address: "Camino Maldonado 5600, Carrasco, Montevideo", lat: -34.88, lng: -56.062 },
  { name: "Mini Mercado Centro", address: "Av. 8 de Octubre 2800, Tres Cruces, Montevideo", lat: -34.895, lng: -56.165 }
];

const DEMO_PRODUCTS: Array<Omit<GpsProduct, "id">> = [
  { name: "Agua mineral 500ml", price: 45 },
  { name: "Gaseosa cola 1.5L", price: 95 },
  { name: "Galletitas surtidas", price: 120 },
  { name: "Pan lactal", price: 80 },
  { name: "Aceite de girasol 900ml", price: 150 },
  { name: "Fideos 500g", price: 65 }
];

@Injectable()
export class GpsDataService implements OnModuleInit {
  private ensureTablesPromise: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureDemoData();
  }

  async listClients(): Promise<GpsClient[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<ClientRow[]>(`SELECT id, name, address, lat, lng FROM saas_gps_clients ORDER BY name ASC`);
    return rows.map((row) => ({ id: row.id, name: row.name, address: row.address, lat: Number(row.lat), lng: Number(row.lng) }));
  }

  async listProducts(): Promise<GpsProduct[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<ProductRow[]>(`SELECT id, name, price FROM saas_gps_products ORDER BY name ASC`);
    return rows.map((row) => ({ id: row.id, name: row.name, price: Number(row.price) }));
  }

  async createSale(dto: CreateGpsSaleDto, sellerUsername: string): Promise<GpsSale> {
    await this.ensureTables();

    const clientRows = await this.databaseService.query<ClientRow[]>(
      `SELECT id, name, address, lat, lng FROM saas_gps_clients WHERE id = ? LIMIT 1`,
      [dto.clientId]
    );
    const client = clientRows[0];
    if (!client) throw new NotFoundException("Cliente no encontrado.");

    const productIds = dto.items.map((item) => item.productId);
    const productRows = await this.databaseService.query<ProductRow[]>(
      `SELECT id, name, price FROM saas_gps_products WHERE id IN (${productIds.map(() => "?").join(",")})`,
      productIds
    );
    const productsById = new Map(productRows.map((row) => [row.id, row]));

    const items: GpsSaleItem[] = dto.items.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) throw new NotFoundException(`Producto ${item.productId} no encontrado.`);
      return { productId: product.id, productName: product.name, quantity: item.quantity, unitPrice: Number(product.price) };
    });
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_gps_sales (client_id, client_name, client_address, client_lat, client_lng, seller_username, items_json, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [client.id, client.name, client.address, client.lat, client.lng, sellerUsername, JSON.stringify(items), total]
    );
    const insertId = result.insertId;

    return {
      id: insertId,
      clientId: client.id,
      clientName: client.name,
      clientAddress: client.address,
      clientLat: Number(client.lat),
      clientLng: Number(client.lng),
      sellerUsername,
      items,
      total,
      status: "pendiente",
      createdAt: new Date().toISOString()
    };
  }

  async listPendingSales(): Promise<GpsSale[]> {
    await this.ensureTables();
    const rows = await this.databaseService.query<SaleRow[]>(
      `SELECT id, client_id, client_name, client_address, client_lat, client_lng, seller_username, items_json, total, status,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
       FROM saas_gps_sales WHERE status = 'pendiente' ORDER BY created_at ASC`
    );
    return rows.map((row) => this.mapSale(row));
  }

  async markDelivered(saleId: number): Promise<void> {
    await this.ensureTables();
    await this.databaseService.execute(`UPDATE saas_gps_sales SET status = 'entregado' WHERE id = ?`, [saleId]);
  }

  private mapSale(row: SaleRow): GpsSale {
    return {
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      clientAddress: row.client_address,
      clientLat: Number(row.client_lat),
      clientLng: Number(row.client_lng),
      sellerUsername: row.seller_username,
      items: typeof row.items_json === "string" ? JSON.parse(row.items_json) : row.items_json,
      total: Number(row.total),
      status: row.status,
      createdAt: `${row.created_at}Z`
    };
  }

  private async ensureTables() {
    if (!this.ensureTablesPromise) {
      this.ensureTablesPromise = this.createTables().catch((error) => {
        this.ensureTablesPromise = null;
        throw error;
      });
    }
    await this.ensureTablesPromise;
  }

  private async createTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_clients (
         id INT AUTO_INCREMENT PRIMARY KEY,
         name VARCHAR(120) NOT NULL,
         address VARCHAR(200) NOT NULL,
         lat DECIMAL(10, 6) NOT NULL,
         lng DECIMAL(10, 6) NOT NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_products (
         id INT AUTO_INCREMENT PRIMARY KEY,
         name VARCHAR(120) NOT NULL,
         price DECIMAL(10, 2) NOT NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_gps_sales (
         id INT AUTO_INCREMENT PRIMARY KEY,
         client_id INT NOT NULL,
         client_name VARCHAR(120) NOT NULL,
         client_address VARCHAR(200) NOT NULL,
         client_lat DECIMAL(10, 6) NOT NULL,
         client_lng DECIMAL(10, 6) NOT NULL,
         seller_username VARCHAR(60) NOT NULL,
         items_json JSON NOT NULL,
         total DECIMAL(10, 2) NOT NULL,
         status ENUM('pendiente', 'entregado') NOT NULL DEFAULT 'pendiente',
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  // Solo siembra clientes/productos demo la primera vez (tablas recien
  // creadas, sin filas).
  private async ensureDemoData() {
    const clientCountRows = await this.databaseService.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM saas_gps_clients`);
    if (Number(clientCountRows[0]?.count ?? 0) === 0) {
      for (const client of DEMO_CLIENTS) {
        await this.databaseService.execute(`INSERT INTO saas_gps_clients (name, address, lat, lng) VALUES (?, ?, ?, ?)`, [
          client.name,
          client.address,
          client.lat,
          client.lng
        ]);
      }
    }

    const productCountRows = await this.databaseService.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM saas_gps_products`);
    if (Number(productCountRows[0]?.count ?? 0) === 0) {
      for (const product of DEMO_PRODUCTS) {
        await this.databaseService.execute(`INSERT INTO saas_gps_products (name, price) VALUES (?, ?)`, [product.name, product.price]);
      }
    }
  }
}
