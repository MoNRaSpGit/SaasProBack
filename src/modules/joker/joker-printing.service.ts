import { BadRequestException, Injectable } from "@nestjs/common";
import { createSign } from "crypto";

// Certificado publico + firma para que QZ Tray confie en el sitio sin
// mostrar el cartel de "Signature (missing) / Validity (invalid)" en cada
// conexion. QZ_CERTIFICATE y QZ_PRIVATE_KEY se generaron una sola vez con
// openssl y se guardan como variables de entorno (el PEM con los saltos de
// linea reemplazados por "\n" literal). No toca la base de datos para
// nada, por eso es su propio servicio chico en vez de ir mezclado con el
// resto.
@Injectable()
export class JokerPrintingService {
  getQzCertificate(): string {
    const certificate = process.env.QZ_CERTIFICATE;
    if (!certificate) {
      throw new BadRequestException("QZ_CERTIFICATE no esta configurado en el servidor.");
    }
    return certificate.replace(/\\n/g, "\n");
  }

  signQzRequest(toSign: string): { signature: string } {
    const privateKey = process.env.QZ_PRIVATE_KEY;
    if (!privateKey) {
      throw new BadRequestException("QZ_PRIVATE_KEY no esta configurado en el servidor.");
    }

    const sign = createSign("RSA-SHA512");
    sign.update(toSign);
    sign.end();
    const signature = sign.sign(privateKey.replace(/\\n/g, "\n"), "base64");

    return { signature };
  }
}
