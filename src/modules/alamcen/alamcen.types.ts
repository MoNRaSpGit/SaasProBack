export type AlamcenProductLookupResponse = {
  id: number;
  legacyProductoId: number | null;
  nombre: string;
  descripcion: string | null;
  barcode: string | null;
  barcodeNormalized: string | null;
  precioVenta: number;
  precioLista: number | null;
  stockActual: number;
  categoria: string | null;
  categoriaCompact: string | null;
  categoriaId: number | null;
  supplierId: number | null;
  subcategoria: string | null;
  tieneImagen: boolean;
  estado: "activo" | "inactivo" | "sin_stock" | "archivado";
  imagen: string | null;
};
