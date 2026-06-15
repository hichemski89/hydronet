/**
 * Sérialise le SVG du plan réseau et le rasterise en PNG (dataURL) pour le rapport.
 * Renvoie null si la capture échoue.
 */
export async function captureCanvasPng(selector = '.network-canvas'): Promise<string | null> {
  const svg = document.querySelector(selector) as SVGSVGElement | null;
  if (!svg) return null;

  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const xml = new XMLSerializer().serializeToString(clone);
  const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2; // meilleure résolution dans le PDF
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svg64;
  });
}
