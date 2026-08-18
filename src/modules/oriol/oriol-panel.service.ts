import { BadRequestException, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { UpdateOriolCierreDiaDto } from "./dto/update-oriol-cierre-dia.dto";
import {
  DIAS_SEMANA,
  anioMesActualUruguay,
  buildMonthRangeUtc,
  buildTodayRangeUtc,
  buildYesterdayRangeUtc,
  toIsoDateOnly,
  toIsoString,
  fechaUyYMD
} from "./oriol.dateUtils";
import { OriolConfigService } from "./oriol-config.service";
import {
  OriolCierreDia,
  OriolMonthHistoryItem,
  OriolMonthSummary,
  OriolMonthWeek,
  OriolPanelHoy,
  OriolPanelMovimiento,
  OriolPaymentMethod,
  OriolSaleItem
} from "./oriol.types";

// El 30% se resta de la ganancia bruta (efectivo del dia - pagos a
// proveedores) como estimacion de gastos/impuestos, tal como lo tenia el
// sistema original.
const PORCENTAJE_GANANCIA_NETA = 0.7;

@Injectable()
export class OriolPanelService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: OriolConfigService
  ) {}

  // ---------- Panel (caja en vivo, sin cierre) ----------

  // Todo se calcula en vivo desde saas_oriol_ventas/saas_oriol_pagos en
  // cada llamada -- no hay tabla de cierre ni total guardado que se pueda
  // desincronizar de las ventas reales.
  async getPanelHoy(): Promise<OriolPanelHoy> {
    const { startIso, endIso } = buildTodayRangeUtc();

    // Las 5 consultas son independientes entre si -- van todas en paralelo
    // en vez de una atras de la otra para no sumar su latencia (el Panel
    // se consulta seguido, cada round-trip de mas se nota).
    const [ventasPorMetodo, pagosRows, config, ventasDetalleRows, pagosDetalleRows] = await Promise.all([
      this.databaseService.query<RowDataPacket[]>(
        `SELECT metodo_pago, SUM(total_pesos) AS pesos, SUM(total_dolares) AS dolares
         FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ? GROUP BY metodo_pago`,
        [startIso, endIso]
      ),
      this.databaseService.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(valor), 0) AS total FROM saas_oriol_pagos WHERE fecha >= ? AND fecha < ?`,
        [startIso, endIso]
      ),
      this.configService.getConfig(),
      this.databaseService.query<RowDataPacket[]>(
        `SELECT detalle, fecha FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ? ORDER BY fecha DESC`,
        [startIso, endIso]
      ),
      this.databaseService.query<RowDataPacket[]>(
        `SELECT valor, detalle, fecha FROM saas_oriol_pagos WHERE fecha >= ? AND fecha < ? ORDER BY fecha DESC`,
        [startIso, endIso]
      )
    ]);

    const totalesPorMetodo: Record<OriolPaymentMethod, { pesos: number; dolares: number }> = {
      efectivo: { pesos: 0, dolares: 0 },
      tarjeta: { pesos: 0, dolares: 0 },
      credito: { pesos: 0, dolares: 0 }
    };
    for (const row of ventasPorMetodo) {
      const metodo = row.metodo_pago as OriolPaymentMethod;
      totalesPorMetodo[metodo] = { pesos: Number(row.pesos) || 0, dolares: Number(row.dolares) || 0 };
    }

    const pagosDelDiaPesos = Number(pagosRows[0]?.total) || 0;
    const { cambio, tasaDolar } = config;

    const efectivoEquivalente = totalesPorMetodo.efectivo.pesos + totalesPorMetodo.efectivo.dolares * tasaDolar;
    const cajaActualPesos = cambio + efectivoEquivalente - pagosDelDiaPesos;
    const gananciaPesos = (efectivoEquivalente - pagosDelDiaPesos) * PORCENTAJE_GANANCIA_NETA;

    const movimientos: OriolPanelMovimiento[] = [];
    for (const row of ventasDetalleRows) {
      const fechaIso = toIsoString(row.fecha);
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
        fecha: toIsoString(row.fecha)
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
      const clave = fechaUyYMD(row.fecha as string | Date);
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
      porDia.set(toIsoDateOnly(row.fecha as string | Date), {
        pesos: Number(row.total_pesos) || 0,
        dolares: Number(row.total_dolares) || 0
      });
    }
    return porDia;
  }

  async getMonthSummary(anio: number, mes: number): Promise<OriolMonthSummary> {
    const { startIso, endIso, daysInMonth } = buildMonthRangeUtc(anio, mes);
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
    const { anio: anioActual, mes: mesActual } = anioMesActualUruguay();

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

    const { startIso } = buildMonthRangeUtc(meses[0].anio, meses[0].mes);
    const { endIso } = buildMonthRangeUtc(meses[meses.length - 1].anio, meses[meses.length - 1].mes);
    const primerDia = `${meses[0].anio}-${String(meses[0].mes).padStart(2, "0")}-01`;
    const ultimoMes = meses[meses.length - 1];
    const { daysInMonth: diasUltimoMes } = buildMonthRangeUtc(ultimoMes.anio, ultimoMes.mes);
    const ultimoDia = `${ultimoMes.anio}-${String(ultimoMes.mes).padStart(2, "0")}-${String(diasUltimoMes).padStart(2, "0")}`;

    const [enVivoPorDia, cierresPorDia] = await Promise.all([
      this.getVentasEnVivoPorDia(startIso, endIso),
      this.getCierresPorDia(primerDia, ultimoDia)
    ]);

    return {
      items: meses.map(({ anio: itemAnio, mes: itemMes }) => {
        const { daysInMonth } = buildMonthRangeUtc(itemAnio, itemMes);
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
    const { startIso, endIso, fechaYMD } = buildYesterdayRangeUtc();

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
}
