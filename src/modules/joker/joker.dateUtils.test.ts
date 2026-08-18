import { describe, expect, it } from "vitest";
import { buildMonthRangeUtc, buildStoreDayRangeUtc, getStoreDateLabel, toIsoDateOnly, toIsoString } from "./joker.dateUtils";

describe("getStoreDateLabel", () => {
  it("un pedido a las 3am (hora Uruguay) todavia cuenta como el dia anterior (corte a las 5am)", () => {
    // 2026-08-18 03:00 UY = 2026-08-18 06:00 UTC -- deberia contar como 17/08.
    const threeAmUy = new Date("2026-08-18T06:00:00.000Z");
    expect(getStoreDateLabel(threeAmUy)).toBe("2026-08-17");
  });

  it("un pedido a las 6am (hora Uruguay) ya cuenta como el dia nuevo", () => {
    // 2026-08-18 06:00 UY = 2026-08-18 09:00 UTC -- deberia contar como 18/08.
    const sixAmUy = new Date("2026-08-18T09:00:00.000Z");
    expect(getStoreDateLabel(sixAmUy)).toBe("2026-08-18");
  });
});

describe("buildStoreDayRangeUtc", () => {
  it("arranca el dia comercial a las 5am hora Uruguay (8am UTC) y termina a las 5am del dia siguiente", () => {
    const { startIso, endIso } = buildStoreDayRangeUtc("2026-08-18");
    expect(startIso).toBe("2026-08-18 08:00:00");
    expect(endIso).toBe("2026-08-19 08:00:00");
  });

  it("rechaza una fecha con formato invalido", () => {
    expect(() => buildStoreDayRangeUtc("18/08/2026")).toThrow();
  });
});

describe("buildMonthRangeUtc", () => {
  it("calcula la cantidad de dias del mes correctamente, incluido febrero bisiesto", () => {
    expect(buildMonthRangeUtc(2026, 8).daysInMonth).toBe(31);
    expect(buildMonthRangeUtc(2028, 2).daysInMonth).toBe(29); // bisiesto
    expect(buildMonthRangeUtc(2026, 2).daysInMonth).toBe(28);
  });

  it("el rango del mes va del dia comercial 1 al dia comercial 1 del mes siguiente", () => {
    const { startIso, endIso } = buildMonthRangeUtc(2026, 8);
    expect(startIso).toBe("2026-08-01 08:00:00");
    expect(endIso).toBe("2026-09-01 08:00:00");
  });
});

describe("toIsoDateOnly / toIsoString", () => {
  it("toIsoDateOnly funciona igual para string y Date", () => {
    expect(toIsoDateOnly("2026-08-18T10:00:00.000Z")).toBe("2026-08-18");
    expect(toIsoDateOnly(new Date("2026-08-18T10:00:00.000Z"))).toBe("2026-08-18");
  });

  it("toIsoString deja un string tal cual y convierte un Date", () => {
    expect(toIsoString("2026-08-18 10:00:00")).toBe("2026-08-18 10:00:00");
    expect(toIsoString(new Date("2026-08-18T10:00:00.000Z"))).toBe("2026-08-18T10:00:00.000Z");
  });
});
