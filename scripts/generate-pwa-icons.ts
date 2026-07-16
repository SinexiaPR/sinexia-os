/**
 * Generate PWA icon PNGs (Android, maskable, iOS) from public/favicon.svg.
 *
 * Usage:
 *   npx tsx scripts/generate-pwa-icons.ts
 *
 * Re-run whenever the source favicon.svg changes.
 */

import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const BRAND_COLOR = "#1e3a5f";
const PUBLIC_DIR = resolve(process.cwd(), "public");
const ICONS_DIR = resolve(PUBLIC_DIR, "icons");
const SOURCE_SVG = resolve(PUBLIC_DIR, "favicon.svg");

async function readSourceSvg() {
  return readFile(SOURCE_SVG, "utf-8");
}

/** Standard (edge-to-edge) icon: the source mark rendered at full bleed. */
async function generateStandardIcon(svg: string, size: number, outPath: string) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
}

/**
 * Maskable icon: composite the mark at ~65% scale, centered on an opaque
 * background square, so it survives Android's circular/squircle safe-zone
 * clipping without losing content.
 */
async function generateMaskableIcon(svg: string, size: number, outPath: string) {
  const contentSize = Math.round(size * 0.65);
  const contentBuffer = await sharp(Buffer.from(svg))
    .resize(contentSize, contentSize)
    .png()
    .toBuffer();

  const offset = Math.round((size - contentSize) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_COLOR,
    },
  })
    .composite([{ input: contentBuffer, left: offset, top: offset }])
    .png()
    .toFile(outPath);
}

/** iOS home-screen icon: opaque background, no alpha (iOS applies its own mask). */
async function generateAppleTouchIcon(svg: string, size: number, outPath: string) {
  const contentBuffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BRAND_COLOR,
    },
  })
    .composite([{ input: contentBuffer, left: 0, top: 0 }])
    .flatten({ background: BRAND_COLOR })
    .png()
    .toFile(outPath);
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const svg = await readSourceSvg();

  await Promise.all([
    generateStandardIcon(svg, 192, resolve(ICONS_DIR, "icon-192.png")),
    generateStandardIcon(svg, 512, resolve(ICONS_DIR, "icon-512.png")),
    generateMaskableIcon(svg, 192, resolve(ICONS_DIR, "icon-maskable-192.png")),
    generateMaskableIcon(svg, 512, resolve(ICONS_DIR, "icon-maskable-512.png")),
    generateAppleTouchIcon(svg, 180, resolve(PUBLIC_DIR, "apple-touch-icon.png")),
  ]);

  console.log("Generated PWA icons in public/icons and public/apple-touch-icon.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
