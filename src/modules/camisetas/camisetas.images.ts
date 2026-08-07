// Genera una imagen de camiseta de futbol generica (no de ningun equipo
// real) como SVG, para no depender de fotos externas ni de derechos de
// marca. Se devuelve como data URI, lista para usar en un <img src>.
function buildJerseySvg(primaryColor: string, secondaryColor: string, number: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#f1f5f9" />
    <path
      d="M60 30 L20 55 L35 85 L55 72 L55 175 L145 175 L145 72 L165 85 L180 55 L140 30 L120 40 Q100 52 80 40 Z"
      fill="${primaryColor}"
      stroke="#0f172a"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <path d="M55 72 L55 100 L35 100 L35 85 Z" fill="${secondaryColor}" />
    <path d="M145 72 L145 100 L165 100 L165 85 Z" fill="${secondaryColor}" />
    <path d="M80 40 Q100 52 120 40 L120 55 Q100 66 80 55 Z" fill="${secondaryColor}" />
    <text x="100" y="135" font-size="56" font-family="Arial, sans-serif" font-weight="900" fill="${secondaryColor}" text-anchor="middle">${number}</text>
  </svg>`;
}

export function buildJerseyImageDataUri(primaryColor: string, secondaryColor: string, number: number): string {
  const svg = buildJerseySvg(primaryColor, secondaryColor, number);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
