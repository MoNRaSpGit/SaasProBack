import { BadRequestException, Injectable } from "@nestjs/common";
import { createSign } from "crypto";

// Mismo mecanismo que joker-printing.service.ts, reusando el MISMO
// certificado/clave (QZ_CERTIFICATE, QZ_PRIVATE_KEY -- ya configurados en
// el backend compartido) para que QZ Tray, si ya confia en ese
// certificado desde Joker, confie tambien aca sin volver a preguntar
// "Permitir" en cada conexion.
@Injectable()
export class EjemploPrintingService {
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
