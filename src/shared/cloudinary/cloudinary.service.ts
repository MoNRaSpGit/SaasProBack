import { Injectable } from "@nestjs/common";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  bytes: number;
};

// Almacenamiento de imagenes en la nube (24/10/2026, pedido explicito):
// en vez de guardar binarios pesados en la base de datos compartida, se
// suben a Cloudinary y solo se guarda la URL. Compartido para poder
// reusarlo en otros proyectos ademas de Piloto.
@Injectable()
export class CloudinaryService {
  private configured = false;

  private ensureConfigured() {
    if (this.configured) return;

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    this.configured = true;
  }

  isConfigured(): boolean {
    return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  }

  // folder agrupa las imagenes por proyecto en el panel de Cloudinary (ej:
  // "piloto/products") -- mas facil de encontrar/borrar que todo suelto.
  async uploadBuffer(buffer: Buffer, folder: string, publicId?: string): Promise<CloudinaryUploadResult> {
    this.ensureConfigured();

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, public_id: publicId, overwrite: true, resource_type: "image" },
        (error, response) => {
          if (error || !response) {
            reject(error || new Error("Cloudinary no devolvio resultado"));
            return;
          }
          resolve(response);
        }
      );
      uploadStream.end(buffer);
    });

    return { url: result.secure_url, publicId: result.public_id, bytes: result.bytes };
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId);
  }
}
