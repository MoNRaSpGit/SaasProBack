// Convierte TOMAPEDIDOS_CLIENTES.xlsx en backend/scripts/data/distribuidora-clients.json.
// Correr desde frontend-agro (es el unico proyecto con exceljs instalado).
const ExcelJS = require(process.cwd() + "/node_modules/exceljs");
const fs = require("fs");

const SOURCE = "C:/Users/MoNRa/Desktop/MatiasCliente/TOMAPEDIDOS_CLIENTES.xlsx";
const TARGET = "../backend/scripts/data/distribuidora-clients.json";

const val = (c) => {
  const v = c.value;
  if (v && typeof v === "object") {
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text) return v.text;
    return null;
  }
  return v;
};
const S = (v) => (v == null ? "" : String(v).trim().replace(/\s+/g, " "));
// Basura: vacio, solo signos/ceros, o una sola letra repetida ("vvv", "hhh").
const junk = (s) => !s || s.length < 2 || /^[\s.\-_,*0]*$/.test(s) || /^(.)\1+$/i.test(s) || s.startsWith("[");
// RUT uruguayo: 12 digitos, digito verificador modulo 11 y "00" en las
// posiciones 9-10 (sin eso pasan numeros tipeados al azar).
const validRut = (d) => {
  if (!/^\d{12}$/.test(d) || /^(\d)\1+$/.test(d) || d.slice(8, 10) !== "00") return false;
  const f = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += Number(d[i]) * f[i];
  let chk = 11 - (sum % 11);
  if (chk === 11) chk = 0;
  return chk !== 10 && chk === Number(d[11]);
};
const phoneOf = (raw) => {
  const s = S(raw);
  if (!/^[\d\s+\-()/]+$/.test(s)) return null;
  const d = s.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 12 && !/^(\d)\1+$/.test(d) ? s : null;
};

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SOURCE);
  const ws = wb.worksheets[0];
  const out = [];
  const st = { nameFromPerson: 0, noName: 0, rut: 0, phone: 0, contact: 0, coords: 0 };

  for (let i = 2; i <= ws.rowCount; i++) {
    const a = [];
    for (let c = 1; c <= 30; c++) a.push(val(ws.getRow(i).getCell(c)));
    if (a.every((x) => x === null || x === "")) continue;

    const person = [a[6], a[7], a[8], a[9]]
      .map(S)
      .filter((x) => !junk(x) && !/^madistribuciones$/i.test(x))
      .join(" ");
    let name = S(a[3]);
    if (junk(name)) {
      if (person) {
        name = person;
        st.nameFromPerson++;
      } else {
        name = "Sin nombre";
        st.noName++;
      }
    }
    const contact = person && person.toLowerCase() !== name.toLowerCase() ? person : null;
    if (contact) st.contact++;

    const doc = S(a[2]).replace(/[\s.\-]/g, "");
    const rut = validRut(doc) ? doc : null;
    if (rut) st.rut++;

    const dir = S(a[11]);
    const barrio = S(a[12]);
    const address = [junk(dir) ? null : dir, junk(barrio) ? null : barrio].filter(Boolean).join(", ") || null;

    const phone = phoneOf(a[17]) || phoneOf(a[16]);
    if (phone) st.phone++;

    const lng = Number(a[28]);
    const lat = Number(a[29]);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (hasCoords) st.coords++;

    out.push({
      code: S(a[0]),
      name: name.slice(0, 160),
      contactName: contact ? contact.slice(0, 160) : null,
      rut,
      address,
      phone,
      sellerCode: S(a[23]) || null,
      route: S(a[24]) || null,
      latitude: hasCoords ? Math.round(lat * 1e7) / 1e7 : null,
      longitude: hasCoords ? Math.round(lng * 1e7) / 1e7 : null
    });
  }

  fs.mkdirSync("../backend/scripts/data", { recursive: true });
  fs.writeFileSync(TARGET, "[\n" + out.map((o) => "  " + JSON.stringify(o)).join(",\n") + "\n]\n");
  console.log("exportados:", out.length, JSON.stringify(st));
  console.log("ruts validos:", JSON.stringify(out.filter((o) => o.rut).map((o) => [o.name, o.rut])));
  console.log("sin direccion:", out.filter((o) => !o.address).length, "| sin nombre:", JSON.stringify(out.filter((o) => o.name === "Sin nombre")));
})().catch((e) => console.log("ERR", e.message));
