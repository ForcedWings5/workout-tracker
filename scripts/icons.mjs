// Renders the home-screen and manifest icons from public/icon.svg. Run with `npm run icons`.
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../public/icon.svg", import.meta.url));
// Android crops icons to a circle; this version keeps the whole picture inside it.
const maskable = await readFile(new URL("../public/icon-maskable.svg", import.meta.url));
const out = new URL("../public/icons/", import.meta.url);
await mkdir(out, { recursive: true });

const sizes = {
  "apple-touch-icon.png": [180, svg],
  "icon-192.png": [192, svg],
  "icon-512.png": [512, svg],
  "icon-maskable-512.png": [512, maskable],
};

for (const [name, [size, source]] of Object.entries(sizes)) {
  await sharp(source, { density: 300 })
    .resize(size, size)
    .flatten({ background: "#2a241f" }) // iOS shows transparency as black; keep the board color
    .png({ compressionLevel: 9 })
    .withMetadata({ exif: { IFD0: { ImageDescription: "Rendered from public/icon.svg, original Workout Tracker artwork" } } })
    .toFile(new URL(name, out).pathname);
  console.log(`icons/${name} ${size}×${size}`);
}
