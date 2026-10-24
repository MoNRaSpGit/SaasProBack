// Migra las imagenes viejas de Piloto (guardadas en binario en
// saas_piloto_product_images) a Cloudinary, para liberar espacio de la
// base compartida. No toca productos que ya estan en Cloudinary ni los
// que no tienen imagen. Al final de cada fila, borra el binario de la
// base (image_data = NULL) -- ahi es donde se libera el espacio real.
//
// Uso:
//   node scripts/migrate-piloto-images-to-cloudinary.js 10    -> prueba con 10
//   node scripts/migrate-piloto-images-to-cloudinary.js       -> todas las que falten
const fs = require("fs");
const mysql = require("mysql2/promise");
const cloudinary = require("cloudinary").v2;

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function uploadBuffer(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, overwrite: true, resource_type: "image" },
      (error, response) => {
        if (error || !response) {
          reject(error || new Error("Cloudinary no devolvio resultado"));
          return;
        }
        resolve(response);
      }
    );
    stream.end(buffer);
  });
}

async function main() {
  loadEnvFile();
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const limitArg = Number(process.argv[2]);
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : null;

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  // limit ya viene validado arriba (Number.isFinite + entero positivo), se
  // puede interpolar derecho -- mysql2 .execute() no acepta bindear LIMIT
  // como placeholder en esta version.
  const [rows] = await conn.execute(
    `SELECT product_id, image_data, mime_type, byte_size
     FROM saas_piloto_product_images
     WHERE cloudinary_url IS NULL AND image_data IS NOT NULL
     ORDER BY product_id ASC
     ${limit ? `LIMIT ${limit}` : ""}`
  );

  console.log(`Migrando ${rows.length} imagen(es)...`);
  let migratedBytes = 0;
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const upload = await uploadBuffer(row.image_data, "piloto/products", `product-${row.product_id}`);
      await conn.execute(
        `UPDATE saas_piloto_product_images
         SET image_data = NULL, cloudinary_url = ?, cloudinary_public_id = ?
         WHERE product_id = ?`,
        [upload.secure_url, upload.public_id, row.product_id]
      );
      migratedBytes += Number(row.byte_size || 0);
      ok += 1;
      console.log(`  OK  producto ${row.product_id} -> ${upload.secure_url}`);
    } catch (error) {
      failed += 1;
      console.error(`  ERROR producto ${row.product_id}: ${error?.message || error}`);
    }
  }

  await conn.end();
  console.log(`\nListo: ${ok} migradas, ${failed} con error. Espacio liberado en la base: ~${(migratedBytes / 1024 / 1024).toFixed(2)} MB.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
