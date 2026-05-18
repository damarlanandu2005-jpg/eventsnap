/**
 * POST /api/scan
 *
 * Guest face scan endpoint.
 * Uses InsightFace (Railway Python service) + pgvector cosine similarity.
 *
 * FormData fields:
 *   selfie  - File (image)
 *   eventId - string (UUID)
 *
 * Returns: { photos: [{ id, thumbUrl, fullUrl, filename, similarity }] }
 */

import { IncomingForm } from "formidable";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { supabaseAdmin } from "../../lib/supabase";
import { searchByImage } from "../../lib/face";
import { isRawExtension } from "../../lib/face/image";

export const config = {
  api: { bodyParser: false },
};

// Selfies are processed regardless of source format — sharp will normalise them
// down to a JPEG before either face provider sees them. We still keep a sanity
// check against truly unknown formats below.
const ALLOWED_FORMATS = new Set([
  "jpeg", "jpg", "png", "webp", "heic", "heif", "tiff", "avif", "gif",
]);
const MIN_FILE_SIZE = 1024; // 1 KB — reject corrupt/empty

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ maxFileSize: 50 * 1024 * 1024, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function getField(f, k) {
  const v = f[k];
  if (!v) return null;
  return Array.isArray(v) ? v[0] : v;
}

function getFile(f, k) {
  const v = f[k];
  if (!v) return null;
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let tempPath = null;
  let redis = null;
  let closeRedisFn = null;

  try {
    const { fields, files } = await parseForm(req);
    const eventId = getField(fields, "eventId");
    const selfieFile = getFile(files, "selfie");

    if (!selfieFile || !eventId) {
      return res.status(400).json({ error: "Missing selfie or eventId" });
    }

    tempPath = selfieFile.filepath || selfieFile.path;
    const selfieBuffer = fs.readFileSync(tempPath);

    // ── Validate image bytes ─────────────────────────────────────
    if (selfieBuffer.length < MIN_FILE_SIZE) {
      return res.status(400).json({ error: "Image file is too small or corrupt." });
    }

    const isRaw = isRawExtension(selfieFile.originalFilename || selfieFile.newFilename || "");

    let imgMeta;
    try {
      imgMeta = await sharp(selfieBuffer, { failOn: "none" }).metadata();
    } catch {
      return res.status(400).json({ error: "Invalid image file. Please upload a JPEG, PNG, HEIC, or RAW photo." });
    }

    if (!isRaw && imgMeta.format && !ALLOWED_FORMATS.has(imgMeta.format.toLowerCase())) {
      return res.status(400).json({ error: `Unsupported image format: ${imgMeta.format}.` });
    }

    // ── Validate event exists and is active ──────────────────────
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, is_active, photographer_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: "Event not found." });
    }

    if (!event.is_active) {
      return res.status(403).json({ error: "This event is no longer accepting photo searches." });
    }

    // ── Redis cache check ─────────────────────────────────────────
    const selfieHash = crypto.createHash("sha256").update(selfieBuffer).update(eventId).digest("hex").slice(0, 20);
    const cacheKey = `scan:${selfieHash}`;

    try {
      if (process.env.REDIS_URL) {
        const { createRedisConnection, closeRedis } = await import("../../lib/redis");
        closeRedisFn = closeRedis;
        redis = createRedisConnection();
        const cached = await redis.get(cacheKey);
        if (cached) {
          await closeRedis(redis);
          redis = null;
          return res.status(200).json({ photos: JSON.parse(cached), cached: true });
        }
      }
    } catch (cacheErr) {
      console.warn("Cache check failed:", cacheErr.message);
      if (redis && closeRedisFn) {
        try { await closeRedisFn(redis); } catch (_) {}
        redis = null;
      }
    }

    // ── Call the active face-recognition provider ────────────────
    let matches = [];
    try {
      const result = await searchByImage({ eventId, imageBuffer: selfieBuffer, photographerId: event.photographer_id });
      if (result.noFaceDetected) {
        return res.status(422).json({
          error: "No face detected in selfie. Please use a clear, well-lit, front-facing photo.",
          photos: [],
          noFaceDetected: true,
        });
      }
      matches = result.matches || [];
    } catch (faceErr) {
      console.error("Face provider error:", faceErr);
      return res.status(500).json({ error: "Face matching failed. Please try again." });
    }

    // ── Increment scans_used for the event owner (fire-and-forget) ──
    // supabase-js v2 .rpc() is a thenable, not a real Promise — wrap
    // in an async IIFE so .catch() is guaranteed to work.
    (async () => {
      try { await supabaseAdmin.rpc("increment_scans_used", { p_event_id: eventId }); }
      catch (_) {}
    })();

    if (!matches || matches.length === 0) {
      return res.status(200).json({ photos: [], message: "No matching photos found for you in this event." });
    }

    // ── Fetch photo records — always filter by event_id ──────────
    const photoIds = [...new Set(matches.map((m) => m.photoId))];
    const { data: photos } = await supabaseAdmin
      .from("event_photos")
      .select("id, r2_key, storage_path, original_filename, thumbnail_path")
      .in("id", photoIds)
      .eq("event_id", eventId)
      .eq("processing_status", "processed");

    if (!photos || photos.length === 0) {
      return res.status(200).json({ photos: [], message: "Photos are still processing. Please try again in a moment." });
    }

    // ── Build response URLs (handles both R2 and Supabase Storage) ──
    // Photos uploaded via /api/photographer/upload-photos live in
    // Supabase Storage (storage_path set, r2_key null). Photos uploaded
    // via the R2 direct-upload flow have r2_key set. Pick the right
    // URL source per-photo so the gallery and downloads always work.
    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    const cfImagesBase = process.env.CF_IMAGES_DELIVERY_URL?.replace(/\/$/, "");

    // Batch-sign Supabase Storage paths in a single round-trip (full +
    // thumb together) — Supabase signs the union and we look them up by
    // path on the way out.
    const supabasePhotos = photos.filter((p) => !p.r2_key && p.storage_path);
    const allPaths = [];
    for (const p of supabasePhotos) {
      allPaths.push(p.storage_path);
      if (p.thumbnail_path) allPaths.push(p.thumbnail_path);
    }
    const signedByPath = new Map();
    if (allPaths.length > 0) {
      try {
        const { data: signed } = await supabaseAdmin.storage
          .from("event-photos")
          .createSignedUrls(allPaths, 86400);
        for (const row of signed || []) {
          if (row?.path && row?.signedUrl) signedByPath.set(row.path, row.signedUrl);
        }
      } catch (e) {
        console.error("Supabase signed URL error:", e.message);
      }
    }
    const signedFullByPath = signedByPath;
    const signedThumbByPath = signedByPath;

    const photosWithUrls = photos.map((photo) => {
      const match = matches.find((m) => m.photoId === photo.id);

      let thumbUrl = null;
      let fullUrl = null;

      if (photo.r2_key && publicBase) {
        // R2-hosted photo
        fullUrl = `${publicBase}/${photo.r2_key}`;
        thumbUrl = cfImagesBase
          ? `${cfImagesBase}/${photo.r2_key}/thumbnail`
          : fullUrl;
      } else if (photo.storage_path) {
        // Supabase Storage-hosted photo
        fullUrl = signedFullByPath.get(photo.storage_path) || null;
        thumbUrl = (photo.thumbnail_path && signedThumbByPath.get(photo.thumbnail_path)) || fullUrl;
      }

      return {
        id: photo.id,
        thumbUrl,
        fullUrl,
        filename: photo.original_filename || `event-photo-${photo.id.slice(0, 8)}.jpg`,
        similarity: match?.similarity ? Math.round(match.similarity * 100) : null,
      };
    });

    photosWithUrls.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    // ── Cache results for 24h ────────────────────────────────────
    if (redis) {
      try {
        await redis.setex(cacheKey, 86400, JSON.stringify(photosWithUrls));
      } catch (_) {}
    }

    return res.status(200).json({ photos: photosWithUrls, total: photosWithUrls.length });

  } catch (err) {
    console.error("Scan handler error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  } finally {
    if (redis && closeRedisFn) {
      try { await closeRedisFn(redis); } catch (_) {}
    }
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
}
