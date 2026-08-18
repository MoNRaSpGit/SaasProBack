import { describe, expect, it } from "vitest";
import {
  anioMesActualUruguay,
  buildMonthRangeUtc,
  buildTodayRangeUtc,
  buildYesterdayRangeUtc,
  fechaUyYMD,
  toIsoDateOnly,
  toIsoString,
  toMysqlDateTime
} from "./oriol.dateUtils";

describe("fechaUyYMD", () => {
  it("un movimiento a la 1am UTC (10pm del dia anterior en Uruguay) cuenta como el dia anterior", () => {
    // 2026-08-18 01:00 UTC = 2026-08-17 22:00 UY.
    expect(fechaUyYMD("2026-08-18 01:00:00")).toBe("2026-08-17");
  });

  it("un movimiento a las 4am UTC (1am en Uruguay) ya cuenta como el dia nuevo", () => {
    // 2026-08-18 04:00 UTC = 2026-08-18 01:00 UY.
    expect(fechaUyYMD("2026-08-18 04:00:00")).toBe("2026-08-18");
  });

  it("funciona igual pasando un Date que un string", () => {
    expect(fechaUyYMD(new Date("2026-08-18T04:00:00.000Z"))).toBe("2026-08-18");
  });
});

describe("buildTodayRangeUtc", () => {
  it("el rango cubre desde las 3am UTC de hoy (medianoche Uruguay) hasta las 3am UTC de manana", () => {
    const { startIso, endIso } = buildTodayRangeUtc();
    const start = new Date(`${startIso.replace(" ", "T")}Z`);
    const end = new Date(`${endIso.replace(" ", "T")}Z`);
    expect(start.getUTCHours()).toBe(3);
    expect(end.getUTCHours()).toBe(3);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("buildYesterdayRangeUtc", () => {
  it("termina justo donde arranca el rango de hoy y dura 24hs", () => {
    const { startIso: startHoy } = buildTodayRangeUtc();
    const { startIso, endIso, fechaYMD } = buildYesterdayRangeUtc();

    expect(endIso).toBe(startHoy);
    const start = new Date(`${startIso.replace(" ", "T")}Z`);
    const end = new Date(`${endIso.replace(" ", "T")}Z`);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(fechaYMD).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("buildMonthRangeUtc", () => {
  it("calcula la cantidad de dias del mes correctamente, incluido febrero bisiesto", () => {
    expect(buildMonthRangeUtc(2026, 8).daysInMonth).toBe(31);
    expect(buildMonthRangeUtc(2028, 2).daysInMonth).toBe(29); // bisiesto
    expect(buildMonthRangeUtc(2026, 2).daysInMonth).toBe(28);
  });

  it("el rango va del dia 1 a las 3am UTC hasta el dia 1 del mes siguiente a las 3am UTC", () => {
    const { startIso, endIso } = buildMonthRangeUtc(2026, 8);
    expect(startIso).toBe("2026-08-01 03:00:00");
    expect(endIso).toBe("2026-09-01 03:00:00");
  });
});

describe("anioMesActualUruguay", () => {
  it("devuelve un anio y mes validos para la fecha actual", () => {
    const { anio, mes } = anioMesActualUruguay();
    expect(anio).toBeGreaterThan(2000);
    expect(mes).toBeGreaterThanOrEqual(1);
    expect(mes).toBeLessThanOrEqual(12);
  });
});

describe("toIsoDateOnly / toIsoString / toMysqlDateTime", () => {
  it("toIsoDateOnly funciona igual para string y Date", () => {
    expect(toIsoDateOnly("2026-08-18T10:00:00.000Z")).toBe("2026-08-18");
    expect(toIsoDateOnly(new Date("2026-08-18T10:00:00.000Z"))).toBe("2026-08-18");
  });

  it("toIsoString deja un string tal cual (agregando Z) y convierte un Date", () => {
    expect(toIsoString("2026-08-18 10:00:00")).toBe("2026-08-18T10:00:00Z");
    expect(toIsoString(new Date("2026-08-18T10:00:00.000Z"))).toBe("2026-08-18T10:00:00.000Z");
  });

  it("toMysqlDateTime convierte un Date al formato 'YYYY-MM-DD HH:mm:ss'", () => {
    expect(toMysqlDateTime(new Date("2026-08-18T10:05:07.000Z"))).toBe("2026-08-18 10:05:07");
  });
});
