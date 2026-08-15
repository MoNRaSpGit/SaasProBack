import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateOriolClientDto } from "./dto/create-oriol-client.dto";
import { CreateOriolPaymentDto } from "./dto/create-oriol-payment.dto";
import { CreateOriolProductDto } from "./dto/create-oriol-product.dto";
import { CreateOriolSaleContadoDto } from "./dto/create-oriol-sale-contado.dto";
import { CreateOriolSaleCreditoDto } from "./dto/create-oriol-sale-credito.dto";
import { UpdateOriolCierreDiaDto } from "./dto/update-oriol-cierre-dia.dto";
import { UpdateOriolConfigDto } from "./dto/update-oriol-config.dto";
import { UpdateOriolProductDto } from "./dto/update-oriol-product.dto";
import { UpdateOriolSaleDto } from "./dto/update-oriol-sale.dto";
import { UpdateOriolStockDto } from "./dto/update-oriol-stock.dto";
import {
  OriolCierreDia,
  OriolClient,
  OriolConfig,
  OriolMonthHistoryItem,
  OriolMonthSummary,
  OriolMonthWeek,
  OriolPanelHoy,
  OriolPanelMovimiento,
  OriolPayment,
  OriolPaymentMethod,
  OriolProduct,
  OriolSale,
  OriolSaleItem
} from "./oriol.types";

// Uruguay es UTC-3 todo el año (sin horario de verano). El reloj del
// server de MySQL no es confiable, asi que "hoy"/"este mes" se calculan
// siempre aca (Node), nunca con NOW()/CURDATE() del lado de la base --
// mismo criterio que ya usa joker.service.ts para su "store day".
const URUGUAY_UTC_OFFSET_HOURS = 3;

// Tasa fija para convertir la porcion en dolares de una venta a un
// equivalente en pesos, unicamente quando hay que sumarla a la deuda de
// un cliente (nunca se suman pesos y dolares como totales "reales").
const TASA_DOLAR = 40;

// El 30% se resta de la ganancia bruta (efectivo del dia - pagos a
// proveedores) como estimacion de gastos/impuestos, tal como lo tenia el
// sistema original.
const PORCENTAJE_GANANCIA_NETA = 0.7;

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const PRODUCT_COLUMNS = "id, name, price, description, currency, codigo_barra, stock, stock_minimo";

type OriolProductRow = RowDataPacket & {
  id: number;
  name: string;
  price: string | number;
  description: string | null;
  currency: "UYU" | "USD";
  codigo_barra: string | null;
  stock: number;
  stock_minimo: number | null;
};

type OriolSaleRow = RowDataPacket & {
  id: number;
  cliente_id: number | null;
  fecha: string | Date;
  total_pesos: string | number;
  total_dolares: string | number;
  detalle: string | OriolSaleItem[] | null;
  metodo_pago: OriolPaymentMethod;
};

type OriolClientRow = RowDataPacket & {
  id: number;
  nombre: string;
  telefono: string | null;
  cedula: string | null;
  deuda: string | number;
  created_at: string | Date;
};

type OriolPaymentRow = RowDataPacket & {
  id: number;
  valor: string | number;
  detalle: string;
  fecha: string | Date;
};

@Injectable()
export class OriolService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ---------- Productos ----------

  async listProducts(): Promise<{ items: OriolProduct[] }> {
    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos ORDER BY name`
    );
    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  // Prioriza el nombre que EMPIEZA con la busqueda ("Ramon" para "ram"),
  // despues el que tiene la busqueda como inicio de una palabra ("Pintura
  // Ramplas" para "ram"), y recien al final cualquier coincidencia en
  // medio de una palabra ("500 GRAMOS" para "ram"). Sin esto, un catalogo
  // grande con muchos nombres que comparten una coincidencia parcial
  // (ej: decenas de productos con "Gramos" en el nombre) tapaba productos
  // mas relevantes fuera del limite de resultados.
  async searchProducts(query: string): Promise<{ items: OriolProduct[] }> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { items: [] };
    }

    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos
       WHERE name LIKE ?
       ORDER BY
         CASE
           WHEN name LIKE ? THEN 0
           WHEN name LIKE ? THEN 1
           ELSE 2
         END,
         name ASC
       LIMIT 30`,
      [`%${trimmed}%`, `${trimmed}%`, `% ${trimmed}%`]
    );
    return { items: rows.map((row) => this.mapProduct(row)) };
  }

  async getProductByBarcode(codigoBarra: string): Promise<{ item: OriolProduct }> {
    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos WHERE codigo_barra = ? LIMIT 1`,
      [codigoBarra]
    );
    if (!rows[0]) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { item: this.mapProduct(rows[0]) };
  }

  async getProduct(productId: number): Promise<{ item: OriolProduct }> {
    const rows = await this.databaseService.query<OriolProductRow[]>(
      `SELECT ${PRODUCT_COLUMNS} FROM saas_oriol_prodcutos WHERE id = ? LIMIT 1`,
      [productId]
    );
    if (!rows[0]) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { item: this.mapProduct(rows[0]) };
  }

  async createProduct(dto: CreateOriolProductDto): Promise<{ item: OriolProduct }> {
    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `INSERT INTO saas_oriol_prodcutos (name, price, description, currency, codigo_barra, stock, stock_minimo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dto.name.trim(), dto.price, dto.description ?? null, dto.currency, dto.codigoBarra ?? null, dto.stock, dto.stockMinimo ?? null]
      );
      return this.getProduct(result.insertId);
    } catch (error) {
      throw this.mapDuplicateBarcodeError(error);
    }
  }

  async updateProduct(productId: number, dto: UpdateOriolProductDto): Promise<{ item: OriolProduct }> {
    try {
      const result = await this.databaseService.execute<ResultSetHeader>(
        `UPDATE saas_oriol_prodcutos
         SET name = ?, price = ?, description = ?, currency = ?, codigo_barra = ?, stock = ?, stock_minimo = ?
         WHERE id = ?`,
        [
          dto.name.trim(),
          dto.price,
          dto.description ?? null,
          dto.currency,
          dto.codigoBarra ?? null,
          dto.stock,
          dto.stockMinimo ?? null,
          productId
        ]
      );
      if (!result.affectedRows) {
        throw new NotFoundException("Producto no encontrado");
      }
      return this.getProduct(productId);
    } catch (error) {
      throw this.mapDuplicateBarcodeError(error);
    }
  }

  async updateStock(productId: number, dto: UpdateOriolStockDto): Promise<{ item: OriolProduct }> {
    const sets: string[] = [];
    const params: Array<number> = [];

    if (dto.stock !== undefined) {
      sets.push("stock = ?");
      params.push(dto.stock);
    }
    if (dto.stockMinimo !== undefined) {
      sets.push("stock_minimo = ?");
      params.push(dto.stockMinimo);
    }

    if (!sets.length) {
      throw new BadRequestException("No hay nada para actualizar");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_oriol_prodcutos SET ${sets.join(", ")} WHERE id = ?`,
      [...params, productId]
    );
    if (!result.affectedRows) {
      throw new NotFoundException("Producto no encontrado");
    }
    return this.getProduct(productId);
  }

  async deleteProduct(productId: number): Promise<{ ok: true }> {
    const result = await this.databaseService.execute<ResultSetHeader>(`DELETE FROM saas_oriol_prodcutos WHERE id = ?`, [
      productId
    ]);
    if (!result.affectedRows) {
      throw new NotFoundException("Producto no encontrado");
    }
    return { ok: true };
  }

  private mapDuplicateBarcodeError(error: unknown) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code === "ER_DUP_ENTRY") {
      return new ConflictException("Ya existe un producto con ese codigo de barra");
    }
    return error as Error;
  }

  private mapProduct(row: OriolProductRow): OriolProduct {
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      description: row.description,
      currency: row.currency,
      codigoBarra: row.codigo_barra,
      stock: row.stock,
      stockMinimo: row.stock_minimo
    };
  }

  // ---------- Ventas ----------

  async createSaleContado(dto: CreateOriolSaleContadoDto): Promise<{ item: OriolSale }> {
    const { totalPesos, totalDolares } = this.sumItemsByCurrency(dto.items);
    const fecha = this.nowMysqlDateTime();

    const saleId = await this.databaseService.withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_oriol_ventas (cliente_id, metodo_pago, total_pesos, total_dolares, detalle, fecha)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dto.clienteId ?? null, dto.metodoPago, totalPesos, totalDolares, JSON.stringify(dto.items), fecha]
      );

      await this.decrementStock(connection, dto.items);

      return result.insertId;
    });

    return this.getSale(saleId);
  }

  async createSaleCredito(dto: CreateOriolSaleCreditoDto): Promise<{ item: OriolSale }> {
    const { totalPesos, totalDolares } = this.sumItemsByCurrency(dto.items);
    const deudaEquivalente = totalPesos + totalDolares * TASA_DOLAR;
    const fecha = this.nowMysqlDateTime();

    const saleId = await this.databaseService.withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_oriol_ventas (cliente_id, metodo_pago, total_pesos, total_dolares, detalle, fecha)
         VALUES (?, 'credito', ?, ?, ?, ?)`,
        [dto.clienteId, totalPesos, totalDolares, JSON.stringify(dto.items), fecha]
      );

      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE saas_oriol_clientes SET deuda = deuda + ? WHERE id = ?`,
        [deudaEquivalente, dto.clienteId]
      );

      if (updateResult.affectedRows === 0) {
        throw new NotFoundException("Cliente no encontrado");
      }

      await this.decrementStock(connection, dto.items);

      return result.insertId;
    });

    return this.getSale(saleId);
  }

  // Corrige una venta ya confirmada. Si el metodo de pago entra o sale de
  // "credito", ajusta la deuda del cliente correspondiente en la misma
  // transaccion. El Panel no necesita ningun ajuste aparte porque
  // recalcula todo en vivo desde saas_oriol_ventas en cada consulta.
  async updateSale(saleId: number, dto: UpdateOriolSaleDto): Promise<{ item: OriolSale }> {
    await this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT metodo_pago, cliente_id, total_pesos, total_dolares FROM saas_oriol_ventas WHERE id = ?`,
        [saleId]
      );
      const current = rows[0] as { metodo_pago: OriolPaymentMethod; cliente_id: number | null; total_pesos: string; total_dolares: string } | undefined;
      if (!current) {
        throw new NotFoundException("Venta no encontrada");
      }

      const metodoActual = current.metodo_pago;
      const metodoNuevo = dto.metodoPago ?? metodoActual;
      const clienteIdFinal = dto.clienteId ?? current.cliente_id;
      const equivalente = Number(current.total_pesos) + Number(current.total_dolares) * TASA_DOLAR;

      if (metodoNuevo !== metodoActual) {
        if (metodoActual === "credito" && current.cliente_id) {
          await connection.execute(`UPDATE saas_oriol_clientes SET deuda = deuda - ? WHERE id = ?`, [
            equivalente,
            current.cliente_id
          ]);
        }
        if (metodoNuevo === "credito") {
          if (!clienteIdFinal) {
            throw new BadRequestException("Para pasar a credito hay que indicar un cliente");
          }
          const [updateResult] = await connection.execute<ResultSetHeader>(
            `UPDATE saas_oriol_clientes SET deuda = deuda + ? WHERE id = ?`,
            [equivalente, clienteIdFinal]
          );
          if (updateResult.affectedRows === 0) {
            throw new NotFoundException("Cliente no encontrado");
          }
        }
      }

      const sets = ["metodo_pago = ?", "cliente_id = ?"];
      const params: Array<string | number | null> = [metodoNuevo, clienteIdFinal ?? null];
      if (dto.fecha) {
        sets.push("fecha = ?");
        params.push(dto.fecha);
      }
      params.push(saleId);

      await connection.execute(`UPDATE saas_oriol_ventas SET ${sets.join(", ")} WHERE id = ?`, params);
    });

    return this.getSale(saleId);
  }

  private async getSale(saleId: number): Promise<{ item: OriolSale }> {
    const rows = await this.databaseService.query<OriolSaleRow[]>(
      `SELECT id, cliente_id, fecha, total_pesos, total_dolares, detalle, metodo_pago FROM saas_oriol_ventas WHERE id = ? LIMIT 1`,
      [saleId]
    );
    if (!rows[0]) {
      throw new NotFoundException("Venta no encontrada");
    }
    return { item: this.mapSale(rows[0]) };
  }

  private async decrementStock(connection: PoolConnection, items: Array<{ id: number; cantidad: number }>) {
    for (const item of items) {
      await connection.execute(`UPDATE saas_oriol_prodcutos SET stock = GREATEST(stock - ?, 0) WHERE id = ?`, [
        item.cantidad,
        item.id
      ]);
    }
  }

  private sumItemsByCurrency(items: Array<{ precio: number; cantidad: number; currency: "UYU" | "USD" }>) {
    let totalPesos = 0;
    let totalDolares = 0;
    for (const item of items) {
      const subtotal = item.precio * item.cantidad;
      if (item.currency === "USD") {
        totalDolares += subtotal;
      } else {
        totalPesos += subtotal;
      }
    }
    return { totalPesos, totalDolares };
  }

  private mapSale(row: OriolSaleRow): OriolSale {
    const detalle = typeof row.detalle === "string" ? (JSON.parse(row.detalle) as OriolSaleItem[]) : row.detalle ?? [];
    return {
      id: row.id,
      clienteId: row.cliente_id,
      fecha: this.toIsoString(row.fecha),
      totalPesos: Number(row.total_pesos),
      totalDolares: Number(row.total_dolares),
      detalle,
      metodoPago: row.metodo_pago
    };
  }

  // ---------- Clientes ----------

  async listClients(): Promise<{ items: OriolClient[] }> {
    const rows = await this.databaseService.query<OriolClientRow[]>(`SELECT * FROM saas_oriol_clientes ORDER BY nombre`);
    return { items: rows.map((row) => this.mapClient(row)) };
  }

  async getClient(clientId: number): Promise<{ item: OriolClient }> {
    const rows = await this.databaseService.query<OriolClientRow[]>(`SELECT * FROM saas_oriol_clientes WHERE id = ? LIMIT 1`, [
      clientId
    ]);
    if (!rows[0]) {
      throw new NotFoundException("Cliente no encontrado");
    }
    return { item: this.mapClient(rows[0]) };
  }

  async createClient(dto: CreateOriolClientDto): Promise<{ item: OriolClient }> {
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_clientes (nombre, telefono, cedula) VALUES (?, ?, ?)`,
      [dto.nombre.trim(), dto.telefono ?? null, dto.cedula ?? null]
    );
    return this.getClient(result.insertId);
  }

  async getClientHistory(clientId: number): Promise<{ items: OriolSale[] }> {
    const rows = await this.databaseService.query<OriolSaleRow[]>(
      `SELECT id, cliente_id, fecha, total_pesos, total_dolares, detalle, metodo_pago
       FROM saas_oriol_ventas WHERE cliente_id = ? ORDER BY fecha DESC`,
      [clientId]
    );
    return { items: rows.map((row) => this.mapSale(row)) };
  }

  private mapClient(row: OriolClientRow): OriolClient {
    return {
      id: row.id,
      nombre: row.nombre,
      telefono: row.telefono,
      cedula: row.cedula,
      deuda: Number(row.deuda),
      createdAt: this.toIsoString(row.created_at)
    };
  }

  // ---------- Pagos ----------

  async listPayments(): Promise<{ items: OriolPayment[] }> {
    const rows = await this.databaseService.query<OriolPaymentRow[]>(`SELECT * FROM saas_oriol_pagos ORDER BY fecha DESC`);
    return { items: rows.map((row) => this.mapPayment(row)) };
  }

  async createPayment(dto: CreateOriolPaymentDto): Promise<{ item: OriolPayment }> {
    const fecha = this.nowMysqlDateTime();
    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_pagos (valor, detalle, fecha) VALUES (?, ?, ?)`,
      [dto.valor, dto.detalle.trim(), fecha]
    );
    const rows = await this.databaseService.query<OriolPaymentRow[]>(`SELECT * FROM saas_oriol_pagos WHERE id = ? LIMIT 1`, [
      result.insertId
    ]);
    return { item: this.mapPayment(rows[0]) };
  }

  private mapPayment(row: OriolPaymentRow): OriolPayment {
    return {
      id: row.id,
      valor: Number(row.valor),
      detalle: row.detalle,
      fecha: this.toIsoString(row.fecha)
    };
  }

  // ---------- Config ----------

  // Tasa fija (no persistida, igual que el original) -- separado de
  // "cambio" (caja inicial del dia), que si se guarda en la tabla.
  getConfig(): { tasaDolar: number } {
    return { tasaDolar: TASA_DOLAR };
  }

  async updateCambio(dto: UpdateOriolConfigDto): Promise<{ item: OriolConfig }> {
    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_config (id, cambio) VALUES (1, ?) ON DUPLICATE KEY UPDATE cambio = ?`,
      [dto.cambio, dto.cambio]
    );
    return { item: { cambio: dto.cambio } };
  }

  // ---------- Panel (caja en vivo, sin cierre) ----------

  // Todo se calcula en vivo desde saas_oriol_ventas/saas_oriol_pagos en
  // cada llamada -- no hay tabla de cierre ni total guardado que se pueda
  // desincronizar de las ventas reales.
  async getPanelHoy(): Promise<OriolPanelHoy> {
    const { startIso, endIso } = this.buildTodayRangeUtc();

    const ventasPorMetodo = await this.databaseService.query<RowDataPacket[]>(
      `SELECT metodo_pago, SUM(total_pesos) AS pesos, SUM(total_dolares) AS dolares
       FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ? GROUP BY metodo_pago`,
      [startIso, endIso]
    );

    const totalesPorMetodo: Record<OriolPaymentMethod, { pesos: number; dolares: number }> = {
      efectivo: { pesos: 0, dolares: 0 },
      tarjeta: { pesos: 0, dolares: 0 },
      credito: { pesos: 0, dolares: 0 }
    };
    for (const row of ventasPorMetodo) {
      const metodo = row.metodo_pago as OriolPaymentMethod;
      totalesPorMetodo[metodo] = { pesos: Number(row.pesos) || 0, dolares: Number(row.dolares) || 0 };
    }

    const pagosRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(valor), 0) AS total FROM saas_oriol_pagos WHERE fecha >= ? AND fecha < ?`,
      [startIso, endIso]
    );
    const pagosDelDiaPesos = Number(pagosRows[0]?.total) || 0;

    const configRows = await this.databaseService.query<RowDataPacket[]>(`SELECT cambio FROM saas_oriol_config WHERE id = 1`);
    const cambio = Number(configRows[0]?.cambio) || 0;

    const efectivoEquivalente = totalesPorMetodo.efectivo.pesos + totalesPorMetodo.efectivo.dolares * TASA_DOLAR;
    const cajaActualPesos = cambio + efectivoEquivalente - pagosDelDiaPesos;
    const gananciaPesos = (efectivoEquivalente - pagosDelDiaPesos) * PORCENTAJE_GANANCIA_NETA;

    const ventasDetalleRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT detalle, fecha FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ? ORDER BY fecha DESC`,
      [startIso, endIso]
    );
    const pagosDetalleRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT valor, detalle, fecha FROM saas_oriol_pagos WHERE fecha >= ? AND fecha < ? ORDER BY fecha DESC`,
      [startIso, endIso]
    );

    const movimientos: OriolPanelMovimiento[] = [];
    for (const row of ventasDetalleRows) {
      const fechaIso = this.toIsoString(row.fecha);
      const items: OriolSaleItem[] = typeof row.detalle === "string" ? JSON.parse(row.detalle) : row.detalle ?? [];
      for (const item of items) {
        movimientos.push({
          tipo: "venta",
          descripcion: item.name,
          cantidad: item.cantidad,
          monto: item.precio * item.cantidad,
          currency: item.currency,
          fecha: fechaIso
        });
      }
    }
    for (const row of pagosDetalleRows) {
      movimientos.push({
        tipo: "pago",
        descripcion: row.detalle,
        cantidad: null,
        monto: Number(row.valor),
        currency: null,
        fecha: this.toIsoString(row.fecha)
      });
    }
    movimientos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return {
      totalTarjeta: totalesPorMetodo.tarjeta,
      totalEfectivo: totalesPorMetodo.efectivo,
      totalCredito: totalesPorMetodo.credito,
      totalPagos: pagosDelDiaPesos,
      cambio,
      caja: cajaActualPesos,
      ventasDelDia: efectivoEquivalente,
      ganancias: gananciaPesos,
      movimientos
    };
  }

  // ---------- Mes ----------
  //
  // A diferencia del resto del modulo (todo en vivo, sin cierre), "Mes" y
  // las graficas usan el cierre diario congelado (saas_oriol_cierres_diarios)
  // como fuente de verdad para cualquier dia que ya lo tenga -- solo cae
  // a calcular en vivo desde saas_oriol_ventas para dias que todavia no
  // se cerraron (tipicamente hoy, antes de que corra el cron de medianoche).

  private async getVentasEnVivoPorDia(startIso: string, endIso: string): Promise<Map<string, { pesos: number; dolares: number }>> {
    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT fecha, total_pesos, total_dolares FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ?`,
      [startIso, endIso]
    );
    const porDia = new Map<string, { pesos: number; dolares: number }>();
    for (const row of rows) {
      const clave = this.fechaUyYMD(row.fecha as string | Date);
      const actual = porDia.get(clave) ?? { pesos: 0, dolares: 0 };
      actual.pesos += Number(row.total_pesos) || 0;
      actual.dolares += Number(row.total_dolares) || 0;
      porDia.set(clave, actual);
    }
    return porDia;
  }

  private async getCierresPorDia(primerDia: string, ultimoDia: string): Promise<Map<string, { pesos: number; dolares: number }>> {
    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT fecha, total_pesos, total_dolares FROM saas_oriol_cierres_diarios WHERE fecha BETWEEN ? AND ?`,
      [primerDia, ultimoDia]
    );
    const porDia = new Map<string, { pesos: number; dolares: number }>();
    for (const row of rows) {
      porDia.set(this.toIsoDateOnly(row.fecha as string | Date), {
        pesos: Number(row.total_pesos) || 0,
        dolares: Number(row.total_dolares) || 0
      });
    }
    return porDia;
  }

  async getMonthSummary(anio: number, mes: number): Promise<OriolMonthSummary> {
    const { startIso, endIso, daysInMonth } = this.buildMonthRangeUtc(anio, mes);
    const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDia = `${anio}-${String(mes).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const [enVivoPorDia, cierresPorDia] = await Promise.all([
      this.getVentasEnVivoPorDia(startIso, endIso),
      this.getCierresPorDia(primerDia, ultimoDia)
    ]);

    const semanas: OriolMonthWeek[] = [];
    let semanaActual: OriolMonthWeek | null = null;

    for (let dia = 1; dia <= daysInMonth; dia++) {
      const numeroSemana = Math.min(4, Math.ceil(dia / 7));
      if (!semanaActual || semanaActual.numero !== numeroSemana) {
        semanaActual = { numero: numeroSemana, totalPesos: 0, totalDolares: 0, dias: [] };
        semanas.push(semanaActual);
      }

      const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const cerrado = cierresPorDia.has(fecha);
      const totalesDia = cerrado ? cierresPorDia.get(fecha)! : (enVivoPorDia.get(fecha) ?? { pesos: 0, dolares: 0 });
      const diaSemana = DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];

      semanaActual.dias.push({ fecha, diaSemana, totalPesos: totalesDia.pesos, totalDolares: totalesDia.dolares, cerrado });
      semanaActual.totalPesos += totalesDia.pesos;
      semanaActual.totalDolares += totalesDia.dolares;
    }

    const totalPesos = semanas.reduce((sum, semana) => sum + semana.totalPesos, 0);
    const totalDolares = semanas.reduce((sum, semana) => sum + semana.totalDolares, 0);
    return { anio, mes, totalPesos, totalDolares, semanas };
  }

  async getMonthHistory(cantidad: number): Promise<{ items: OriolMonthHistoryItem[] }> {
    const cantidadMeses = Math.min(Math.max(cantidad, 1), 12);
    const { anio: anioActual, mes: mesActual } = this.anioMesActualUruguay();

    const meses: Array<{ anio: number; mes: number }> = [];
    let anio = anioActual;
    let mes = mesActual;
    for (let i = 0; i < cantidadMeses; i++) {
      meses.unshift({ anio, mes });
      mes -= 1;
      if (mes < 1) {
        mes = 12;
        anio -= 1;
      }
    }

    const { startIso } = this.buildMonthRangeUtc(meses[0].anio, meses[0].mes);
    const { endIso } = this.buildMonthRangeUtc(meses[meses.length - 1].anio, meses[meses.length - 1].mes);
    const primerDia = `${meses[0].anio}-${String(meses[0].mes).padStart(2, "0")}-01`;
    const ultimoMes = meses[meses.length - 1];
    const { daysInMonth: diasUltimoMes } = this.buildMonthRangeUtc(ultimoMes.anio, ultimoMes.mes);
    const ultimoDia = `${ultimoMes.anio}-${String(ultimoMes.mes).padStart(2, "0")}-${String(diasUltimoMes).padStart(2, "0")}`;

    const [enVivoPorDia, cierresPorDia] = await Promise.all([
      this.getVentasEnVivoPorDia(startIso, endIso),
      this.getCierresPorDia(primerDia, ultimoDia)
    ]);

    return {
      items: meses.map(({ anio: itemAnio, mes: itemMes }) => {
        const { daysInMonth } = this.buildMonthRangeUtc(itemAnio, itemMes);
        let pesos = 0;
        let dolares = 0;
        for (let dia = 1; dia <= daysInMonth; dia++) {
          const fecha = `${itemAnio}-${String(itemMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const totales = cierresPorDia.get(fecha) ?? enVivoPorDia.get(fecha) ?? { pesos: 0, dolares: 0 };
          pesos += totales.pesos;
          dolares += totales.dolares;
        }
        return { anio: itemAnio, mes: itemMes, totalPesos: pesos, totalDolares: dolares };
      })
    };
  }

  // ---------- Cierre diario (fuente de verdad para Mes/graficas) ----------

  // Corre todos los dias a medianoche (hora Uruguay) y congela el total
  // del dia que acaba de terminar. Si ese dia ya se habia corregido a
  // mano (editarCierreDia), no lo pisa -- el valor manual queda como
  // fuente de verdad definitiva para ese dia.
  @Cron("0 0 * * *", { timeZone: "America/Montevideo", name: "oriol-cierre-diario" })
  async cerrarDiaAutomatico(): Promise<void> {
    const { startIso, endIso, fechaYMD } = this.buildYesterdayRangeUtc();

    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_pesos), 0) AS pesos, COALESCE(SUM(total_dolares), 0) AS dolares
       FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ?`,
      [startIso, endIso]
    );
    const totalPesos = Number(rows[0]?.pesos) || 0;
    const totalDolares = Number(rows[0]?.dolares) || 0;

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_cierres_diarios (fecha, total_pesos, total_dolares)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_pesos = IF(editado_manualmente = 1, total_pesos, VALUES(total_pesos)),
         total_dolares = IF(editado_manualmente = 1, total_dolares, VALUES(total_dolares))`,
      [fechaYMD, totalPesos, totalDolares]
    );
  }

  // Correccion manual de un dia ya cerrado (ej: el operario vendio algo
  // fuera del sistema y el cierre automatico quedo corto). Una vez
  // editado, el cron de medianoche ya no lo vuelve a tocar.
  async editarCierreDia(fecha: string, dto: UpdateOriolCierreDiaDto): Promise<{ item: OriolCierreDia }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException("Fecha invalida");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_oriol_cierres_diarios (fecha, total_pesos, total_dolares, editado_manualmente)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         total_pesos = VALUES(total_pesos),
         total_dolares = VALUES(total_dolares),
         editado_manualmente = 1`,
      [fecha, dto.totalPesos, dto.totalDolares]
    );

    return { item: { fecha, totalPesos: dto.totalPesos, totalDolares: dto.totalDolares, editadoManualmente: true } };
  }

  // ---------- Fecha/hora Uruguay (calculado siempre en Node) ----------

  private buildTodayRangeUtc(): { startIso: string; endIso: string } {
    const uruguayNow = new Date(Date.now() - URUGUAY_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    const year = uruguayNow.getUTCFullYear();
    const month = uruguayNow.getUTCMonth();
    const day = uruguayNow.getUTCDate();

    const start = new Date(Date.UTC(year, month, day, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
    const end = new Date(Date.UTC(year, month, day + 1, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
    return { startIso: this.toMysqlDateTime(start), endIso: this.toMysqlDateTime(end) };
  }

  private buildMonthRangeUtc(anio: number, mes: number): { startIso: string; endIso: string; daysInMonth: number } {
    const start = new Date(Date.UTC(anio, mes - 1, 1, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
    const end = new Date(Date.UTC(anio, mes, 1, URUGUAY_UTC_OFFSET_HOURS, 0, 0));
    const daysInMonth = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return { startIso: this.toMysqlDateTime(start), endIso: this.toMysqlDateTime(end), daysInMonth };
  }

  private anioMesActualUruguay(): { anio: number; mes: number } {
    const [anio, mes] = this.fechaUyYMD(new Date()).split("-").map(Number);
    return { anio, mes };
  }

  // Rango del dia anterior (hora Uruguay) -- usado por el cron de
  // medianoche para cerrar el dia que justo termino.
  private buildYesterdayRangeUtc(): { startIso: string; endIso: string; fechaYMD: string } {
    const { startIso: startHoyIso } = this.buildTodayRangeUtc();
    const startHoy = new Date(`${startHoyIso.replace(" ", "T")}Z`);
    const start = new Date(startHoy.getTime() - 24 * 60 * 60 * 1000);
    return { startIso: this.toMysqlDateTime(start), endIso: startHoyIso, fechaYMD: this.fechaUyYMD(start) };
  }

  private toIsoDateOnly(value: string | Date): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value.slice(0, 10);
  }

  // Convierte una fecha guardada (interpretada como UTC) al dia calendario
  // que le correspondia en Uruguay -- mismo criterio que buildTodayRangeUtc,
  // para que un dia "cierre" a la medianoche real de Montevideo.
  private fechaUyYMD(fechaUtc: string | Date): string {
    const date = fechaUtc instanceof Date ? fechaUtc : new Date(`${fechaUtc.replace(" ", "T")}Z`);
    const uruguayDate = new Date(date.getTime() - URUGUAY_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    return uruguayDate.toISOString().slice(0, 10);
  }

  private nowMysqlDateTime(): string {
    return this.toMysqlDateTime(new Date());
  }

  private toMysqlDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  private toIsoString(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return `${value.replace(" ", "T")}Z`;
  }
}
