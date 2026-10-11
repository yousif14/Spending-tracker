// Builds every app icon from public/icon.svg (house, cream on teal). Runs before each build (npm run build).
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const svg = readFileSync(join(pub, 'icon.svg'));

// Full-bleed square art: iOS rounds the corners itself; the house sits inside Android's maskable safe circle
const sizes = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['apple-touch-icon-152.png', 152],
  ['apple-touch-icon-167.png', 167],
  ['apple-touch-icon-180.png', 180],
];

const png = size => sharp(svg, { density: 300 }).resize(size, size).png({ palette: true, colors: 64 }).toBuffer();   // flat art: small files (the 180px one is inlined in index.html)

/** favicon.ico holding PNG images (supported by every current browser) */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(i => i.data)]);
}

for (const [name, size] of sizes) writeFileSync(join(pub, name), await png(size));
writeFileSync(join(pub, 'favicon.ico'), ico(await Promise.all([16, 32, 48].map(async size => ({ size, data: await png(size) })))));
console.log(`icons: ${sizes.length} PNGs + favicon.ico from public/icon.svg`);
