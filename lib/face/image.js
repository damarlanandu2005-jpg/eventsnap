/**
 * Image normalisation helpers used by the face providers.
 *
 * Handles:
 *   - RAW formats (CR2, CR3, NEF, ARW, DNG, RAF, RW2, ORF, PEF, SRW…). Sharp
 *     (via libvips) can decode many RAW formats when libvips is built with
 *     libraw support, which is the default on the linux x64 prebuilt binary.
 *     For RAW inputs we always render to JPEG first.
 *   - HEIC/HEIF — also routed through sharp.
 *   - Large files — Rekognition rejects bytes payloads over 5MB, so we always
 *     downscale to fit a max 4096x4096 box and re-encode JPEG @ q85 if the
 *     resulting buffer is too large.
 *
 * The output is always a JPEG buffer suitable for Rekognition / InsightFace.
 */

import sharp from "sharp";

const REKOG_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIM = 4096;

const RAW_EXTENSIONS = new Set([
  "cr2", "cr3", "crw",
  "nef", "nrw",
  "arw", "srf", "sr2",
  "dng",
  "raf",
  "rw2",
  "orf",
  "pef",
  "srw",
  "rwl",
  "dcr", "kdc",
  "x3f",
  "mrw",
  "3fr",
  "iiq",
]);

export function isRawExtension(filenameOrExt) {
  if (!filenameOrExt) return false;
  const ext = String(filenameOrExt).split(".").pop().toLowerCase();
  return RAW_EXTENSIONS.has(ext);
}

/**
 * Convert any supported image input (JPEG/PNG/HEIC/RAW/etc.) into a JPEG buffer
 * that's small enough for AWS Rekognition (≤5 MB) and dimensionally sane.
 */
export async function prepareForRekognition(inputBuffer) {
  let pipeline = sharp(inputBuffer, { failOn: "none" }).rotate();

  const meta = await pipeline.metadata().catch(() => ({}));
  if (meta.width && meta.height && (meta.width > MAX_DIM || meta.height > MAX_DIM)) {
    pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true });
  }

  let out = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  // Re-encode with progressively lower quality if we're still too big.
  let q = 80;
  while (out.length > REKOG_MAX_BYTES && q >= 50) {
    out = await sharp(inputBuffer, { failOn: "none" })
      .rotate()
      .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
    q -= 10;
  }

  if (out.length > REKOG_MAX_BYTES) {
    // Last resort — shrink the dimensions instead of quality.
    out = await sharp(inputBuffer, { failOn: "none" })
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();
  }

  return out;
}

/**
 * For RAW originals we also want a derived JPEG to store alongside the original
 * so the gallery / downloads have something the browser can render. Returns a
 * JPEG buffer at a sensible delivery size.
 */
export async function rawToDeliveryJpeg(inputBuffer) {
  return sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .resize(3000, 3000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
