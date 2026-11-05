import { createRandom } from "./forest";

export const FOREST_FLOOR_SIZE = 128;
const SEED = 20240611;
const PATCHES = 90;
// bright greens; the diffuse color of the material darkens them
const SHADES = [
  [200, 255, 190],
  [170, 230, 160],
  [140, 205, 130],
];

// RGBA pixels of the forest floor texture, identical on every call
export function createForestFloorPixels(): Uint8Array {
  const size = FOREST_FLOOR_SIZE;
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels.set([...SHADES[1], 255], i * 4);
  }
  const random = createRandom(SEED);
  for (let patch = 0; patch < PATCHES; patch++) {
    const cx = Math.floor(random() * size);
    const cy = Math.floor(random() * size);
    const radius = 3 + random() * 9;
    const shade = SHADES[Math.floor(random() * SHADES.length)];
    for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
      for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
        if (Math.hypot(dx, dy) <= radius) {
          // wrap around so that the texture tiles seamlessly
          const x = (cx + dx + size) % size;
          const y = (cy + dy + size) % size;
          pixels.set([...shade, 255], (y * size + x) * 4);
        }
      }
    }
  }
  return pixels;
}
