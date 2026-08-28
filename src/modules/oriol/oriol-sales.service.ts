import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { CreateOriolCreditPaymentDto } from "./dto/create-oriol-credit-payment.dto";
import { CreateOriolSaleContadoDto } from "./dto/create-oriol-sale-contado.dto";
import { CreateOriolSaleCreditoDto } from "./dto/create-oriol-sale-credito.dto";
import { UpdateOriolSaleDto } from "./dto/update-oriol-sale.dto";
import { nowMysqlDateTime, toIsoString } from "./oriol.dateUtils";
import { calcularPagoCredito, esPagoIndividualHabilitado } from "./oriol.creditPayment";
import { OriolProductsService } from "./oriol-products.service";
import { OriolCreditPayment, OriolCreditPaymentType, OriolCurrency, OriolPaymentMethod, OriolSale, OriolSaleItem } from "./oriol.types";

type OriolSaleRow = RowDataPacket & {
  id: number;
  cliente_id: number | null;
  fecha: string | Date;
  total_pesos: string | number;
  total_dolares: string | number;
  monto_pagado_pesos: string | number;
  monto_pagado_dolares: string | number;
  detalle: string | OriolSaleItem[] | null;
  metodo_pago: OriolPaymentMethod;
};

type OriolCreditPaymentRow = RowDataPacket & {
  id: number;
  venta_id: number | null;
  cliente_id: number;
  monto: string | number;
  moneda: OriolCurrency;
  tipo: OriolCreditPaymentType;
  saldo_anterior: string | number;
  saldo_nuevo: string | number;
  fecha: string | Date;
};

const SALE_COLUMNS = "id, cliente_id, fecha, total_pesos, total_dolares, monto_pagado_pesos, monto_pagado_dolares, detalle, metodo_pago";

@Injectable()
export class OriolSalesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly productsService: OriolProductsService
  ) {}

  async createSaleContado(dto: CreateOriolSaleContadoDto): Promise<{ item: OriolSale }> {
    const { totalPesos, totalDolares } = this.sumItemsByCurrency(dto.items);
    const fecha = nowMysqlDateTime();

    const saleId = await this.databaseService.withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_oriol_ventas (cliente_id, metodo_pago, total_pesos, total_dolares, detalle, fecha)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dto.clienteId ?? null, dto.metodoPago, totalPesos, totalDolares, JSON.stringify(dto.items), fecha]
      );

      await this.productsService.decrementStock(connection, dto.items);

      return result.insertId;
    });

    return this.getSale(saleId);
  }

  async createSaleCredito(dto: CreateOriolSaleCreditoDto): Promise<{ item: OriolSale }> {
    const { totalPesos, totalDolares } = this.sumItemsByCurrency(dto.items);
    const fecha = nowMysqlDateTime();

    const saleId = await this.databaseService.withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO saas_oriol_ventas (cliente_id, metodo_pago, total_pesos, total_dolares, detalle, fecha)
         VALUES (?, 'credito', ?, ?, ?, ?)`,
        [dto.clienteId, totalPesos, totalDolares, JSON.stringify(dto.items), fecha]
      );

      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE saas_oriol_clientes SET deuda = deuda + ?, deuda_dolares = deuda_dolares + ? WHERE id = ?`,
        [totalPesos, totalDolares, dto.clienteId]
      );

      if (updateResult.affectedRows === 0) {
        throw new NotFoundException("Cliente no encontrado");
      }

      await this.productsService.decrementStock(connection, dto.items);

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
        `SELECT metodo_pago, cliente_id, total_pesos, total_dolares, detalle FROM saas_oriol_ventas WHERE id = ? FOR UPDATE`,
        [saleId]
      );
      const current = rows[0] as
        | {
            metodo_pago: OriolPaymentMethod;
            cliente_id: number | null;
            total_pesos: string;
            total_dolares: string;
            detalle: string | OriolSaleItem[] | null;
          }
        | undefined;
      if (!current) {
        throw new NotFoundException("Venta no encontrada");
      }

      const metodoActual = current.metodo_pago;
      const metodoNuevo = dto.metodoPago ?? metodoActual;
      const clienteIdFinal = dto.clienteId ?? current.cliente_id;
      // *Actual* = antes de tocar nada (para revertir la deuda vieja si
      // cambia el metodo). *Final* = despues de sumar itemsNuevos, si hay
      // (para aplicar la deuda nueva y para el UPDATE de la venta).
      const totalPesosActual = Number(current.total_pesos);
      const totalDolaresActual = Number(current.total_dolares);
      let totalPesosFinal = totalPesosActual;
      let totalDolaresFinal = totalDolaresActual;

      const sets = ["metodo_pago = ?", "cliente_id = ?"];
      const params: Array<string | number | null> = [metodoNuevo, clienteIdFinal ?? null];

      // Agregar productos a una boleta ya guardada (p.ej. "volver" desde la
      // boleta final porque el cliente pide algo mas): suma los items al
      // detalle existente y recalcula el total, sin tocar los items
      // originales.
      if (dto.itemsNuevos?.length) {
        const detalleActual: OriolSaleItem[] =
          typeof current.detalle === "string" ? (JSON.parse(current.detalle) as OriolSaleItem[]) : current.detalle ?? [];
        const { totalPesos: deltaPesos, totalDolares: deltaDolares } = this.sumItemsByCurrency(dto.itemsNuevos);
        totalPesosFinal += deltaPesos;
        totalDolaresFinal += deltaDolares;

        sets.push("detalle = ?", "total_pesos = ?", "total_dolares = ?");
        params.push(JSON.stringify([...detalleActual, ...dto.itemsNuevos]), totalPesosFinal, totalDolaresFinal);

        await this.productsService.decrementStock(connection, dto.itemsNuevos);

        // Caso comun: se agrega producto sin cambiar metodo ni cliente. Si
        // la boleta sigue a credito, la deuda solo sube por la diferencia
        // agregada (el resto de la logica de deuda, mas abajo, cubre el
        // caso en que ademas cambia el metodo o el cliente, usando ya el
        // total final con los items nuevos incluidos).
        if (metodoNuevo === "credito" && metodoNuevo === metodoActual && clienteIdFinal === current.cliente_id) {
          if (!clienteIdFinal) {
            throw new BadRequestException("Para agregar productos a credito hay que indicar un cliente");
          }
          const [updateResult] = await connection.execute<ResultSetHeader>(
            `UPDATE saas_oriol_clientes SET deuda = deuda + ?, deuda_dolares = deuda_dolares + ? WHERE id = ?`,
            [deltaPesos, deltaDolares, clienteIdFinal]
          );
          if (updateResult.affectedRows === 0) {
            throw new NotFoundException("Cliente no encontrado");
          }
        }
      }

      if (metodoNuevo !== metodoActual) {
        if (metodoActual === "credito" && current.cliente_id) {
          await connection.execute(
            `UPDATE saas_oriol_clientes SET deuda = deuda - ?, deuda_dolares = deuda_dolares - ? WHERE id = ?`,
            [totalPesosActual, totalDolaresActual, current.cliente_id]
          );
        }
        if (metodoNuevo === "credito") {
          if (!clienteIdFinal) {
            throw new BadRequestException("Para pasar a credito hay que indicar un cliente");
          }
          const [updateResult] = await connection.execute<ResultSetHeader>(
            `UPDATE saas_oriol_clientes SET deuda = deuda + ?, deuda_dolares = deuda_dolares + ? WHERE id = ?`,
            [totalPesosFinal, totalDolaresFinal, clienteIdFinal]
          );
          if (updateResult.affectedRows === 0) {
            throw new NotFoundException("Cliente no encontrado");
          }
        }
      }

      if (dto.fecha) {
        sets.push("fecha = ?");
        params.push(dto.fecha);
      }
      params.push(saleId);

      await connection.execute(`UPDATE saas_oriol_ventas SET ${sets.join(", ")} WHERE id = ?`, params);
    });

    return this.getSale(saleId);
  }

  async getSale(saleId: number): Promise<{ item: OriolSale }> {
    const rows = await this.databaseService.query<OriolSaleRow[]>(
      `SELECT ${SALE_COLUMNS} FROM saas_oriol_ventas WHERE id = ? LIMIT 1`,
      [saleId]
    );
    if (!rows[0]) {
      throw new NotFoundException("Venta no encontrada");
    }
    const pagosPorVenta = await this.getPagosCreditoPorVentas([rows[0].id]);
    return { item: this.mapSale(rows[0], pagosPorVenta.get(rows[0].id) ?? []) };
  }

  // Usado por OriolClientsService para armar el historial de un cliente --
  // mantiene la logica de mapeo/pagos en un solo lugar.
  async getSalesByClientId(clientId: number): Promise<OriolSale[]> {
    const rows = await this.databaseService.query<OriolSaleRow[]>(
      `SELECT ${SALE_COLUMNS} FROM saas_oriol_ventas WHERE cliente_id = ? ORDER BY fecha DESC`,
      [clientId]
    );
    const pagosPorVenta = await this.getPagosCreditoPorVentas(rows.map((row) => row.id));
    return rows.map((row) => this.mapSale(row, pagosPorVenta.get(row.id) ?? []));
  }

  // Pago (total o parcial) de una boleta de credito puntual -- ajusta la
  // deuda del cliente y deja un registro permanente en
  // saas_oriol_pagos_credito, incluso una vez que la boleta queda saldada
  // (el "Pagar" desaparece del front, pero los datos nunca se borran).
  async pagarVentaCredito(ventaId: number, dto: CreateOriolCreditPaymentDto): Promise<{ item: OriolSale }> {
    await this.databaseService.withTransaction(async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, cliente_id, metodo_pago, fecha, total_pesos, total_dolares, monto_pagado_pesos, monto_pagado_dolares
         FROM saas_oriol_ventas WHERE id = ? FOR UPDATE`,
        [ventaId]
      );
      const venta = rows[0] as
        | {
            id: number;
            cliente_id: number | null;
            metodo_pago: OriolPaymentMethod;
            fecha: string | Date;
            total_pesos: string;
            total_dolares: string;
            monto_pagado_pesos: string;
            monto_pagado_dolares: string;
          }
        | undefined;
      if (!venta) {
        throw new NotFoundException("Venta no encontrada");
      }
      if (venta.metodo_pago !== "credito" || !venta.cliente_id) {
        throw new BadRequestException("Esta venta no es a credito");
      }
      if (!esPagoIndividualHabilitado(venta.fecha, venta.metodo_pago)) {
        throw new BadRequestException("Esta boleta es anterior a la funcion de pago por boleta");
      }

      // Cada moneda tiene su propio saldo independiente -- una boleta con
      // items mezclados puede deber pesos y dolares a la vez, y este pago
      // solo afecta la moneda indicada en dto.moneda.
      const esDolares = dto.moneda === "USD";
      const total = esDolares ? Number(venta.total_dolares) : Number(venta.total_pesos);
      const montoPagadoActual = (esDolares ? Number(venta.monto_pagado_dolares) : Number(venta.monto_pagado_pesos)) || 0;

      const { montoAPagar, saldoPendiente, saldoNuevo } = calcularPagoCredito({
        total,
        montoPagadoActual,
        tipo: dto.tipo,
        monto: dto.monto
      });

      if (esDolares) {
        await connection.execute(`UPDATE saas_oriol_ventas SET monto_pagado_dolares = monto_pagado_dolares + ? WHERE id = ?`, [
          montoAPagar,
          ventaId
        ]);
        await connection.execute(`UPDATE saas_oriol_clientes SET deuda_dolares = GREATEST(deuda_dolares - ?, 0) WHERE id = ?`, [
          montoAPagar,
          venta.cliente_id
        ]);
      } else {
        await connection.execute(`UPDATE saas_oriol_ventas SET monto_pagado_pesos = monto_pagado_pesos + ? WHERE id = ?`, [
          montoAPagar,
          ventaId
        ]);
        await connection.execute(`UPDATE saas_oriol_clientes SET deuda = GREATEST(deuda - ?, 0) WHERE id = ?`, [
          montoAPagar,
          venta.cliente_id
        ]);
      }
      await connection.execute(
        `INSERT INTO saas_oriol_pagos_credito (venta_id, cliente_id, monto, moneda, tipo, saldo_anterior, saldo_nuevo, fecha)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ventaId, venta.cliente_id, montoAPagar, dto.moneda, dto.tipo, saldoPendiente, saldoNuevo, nowMysqlDateTime()]
      );
    });

    return this.getSale(ventaId);
  }

  private async getPagosCreditoPorVentas(ventaIds: number[]): Promise<Map<number, OriolCreditPayment[]>> {
    const mapa = new Map<number, OriolCreditPayment[]>();
    if (!ventaIds.length) {
      return mapa;
    }
    const placeholders = ventaIds.map(() => "?").join(", ");
    const rows = await this.databaseService.query<OriolCreditPaymentRow[]>(
      `SELECT id, venta_id, cliente_id, monto, moneda, tipo, saldo_anterior, saldo_nuevo, fecha
       FROM saas_oriol_pagos_credito WHERE venta_id IN (${placeholders}) ORDER BY fecha ASC`,
      ventaIds
    );
    for (const row of rows) {
      const pago = this.mapCreditPayment(row);
      if (pago.ventaId === null) {
        continue;
      }
      const lista = mapa.get(pago.ventaId) ?? [];
      lista.push(pago);
      mapa.set(pago.ventaId, lista);
    }
    return mapa;
  }

  private mapCreditPayment(row: OriolCreditPaymentRow): OriolCreditPayment {
    return {
      id: row.id,
      ventaId: row.venta_id,
      clienteId: row.cliente_id,
      monto: Number(row.monto),
      moneda: row.moneda,
      tipo: row.tipo,
      saldoAnterior: Number(row.saldo_anterior),
      saldoNuevo: Number(row.saldo_nuevo),
      fecha: toIsoString(row.fecha)
    };
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

  private mapSale(row: OriolSaleRow, pagos: OriolCreditPayment[] = []): OriolSale {
    const detalle = typeof row.detalle === "string" ? (JSON.parse(row.detalle) as OriolSaleItem[]) : row.detalle ?? [];
    const totalPesos = Number(row.total_pesos);
    const totalDolares = Number(row.total_dolares);
    const montoPagadoPesos = Number(row.monto_pagado_pesos) || 0;
    const montoPagadoDolares = Number(row.monto_pagado_dolares) || 0;
    const esCredito = row.metodo_pago === "credito";
    const saldoPendientePesos = esCredito ? Math.max(totalPesos - montoPagadoPesos, 0) : 0;
    const saldoPendienteDolares = esCredito ? Math.max(totalDolares - montoPagadoDolares, 0) : 0;
    const pagoIndividualHabilitado = esPagoIndividualHabilitado(row.fecha, row.metodo_pago);
    return {
      id: row.id,
      clienteId: row.cliente_id,
      fecha: toIsoString(row.fecha),
      totalPesos,
      totalDolares,
      montoPagadoPesos,
      montoPagadoDolares,
      saldoPendientePesos,
      saldoPendienteDolares,
      pagoIndividualHabilitado,
      detalle,
      metodoPago: row.metodo_pago,
      pagos
    };
  }
}
