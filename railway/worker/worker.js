/**
 * EventSnap BullMQ Worker (Railway Service: eventsnap-worker)
 *
 * Handles two job types:
 *   1. face-processing:{photographerId} — download photo from R2,
 *      call InsightFace /embed-batch, store embeddings in pgvector,
 *      update photo processing_status.
 *
 *   2. zip-jobs — fetch matched photos from R2, zip them, upload zip
 *      back to R2, send email notification to guest.
 *
 * Required environment variables (set in Railway):
 *   REDIS_URL, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL, NEXT_PUBLIC_SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY, INSIGHTFACE_SERVICE_URL, RESEND_API_KEY
 */

import { Worker, Queue } from "bullmq";
import Redis from "ioredis";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import FormData from "form-data";
import JSZip from "jszip";
import { Resend } from "resend";
import sharp from "sharp";

// ── Clients ───────────────────────────────────────────────────────────────────
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Helper: stream R2 object to Buffer ───────────────────────────────────────
async function r2ToBuffer(key) {
  const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key });
  const response = await r2.send(cmd);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Helper: update photo processing status ───────────────────────────────────
async function setPhotoStatus(photoId, status, extra = {}) {
  await supabase
    .from("event_photos")
    .update({ processing_status: status, ...extra })
    .eq("id", photoId);
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKER 1: Face Processing
// Listens to per-photographer queues: face-processing:{photographerId}
// ══════════════════════════════════════════════════════════════════════════════
const faceWorker = new Worker(
  "face-processing",           // Base queue name — BullMQ matches prefix
  async (job) => {
    const { photoId, eventId, photographerId, r2Key } = job.data;
    console.log(`[face] Processing photo ${photoId} for event ${eventId}`);

    // ── 0. Verify photo exists in DB and belongs to declared event ─
    const { data: photoRow } = await supabase
      .from("event_photos")
      .select("id, event_id, photographer_id")
      .eq("id", photoId)
      .eq("event_id", eventId)
      .single();

    if (!photoRow) {
      console.error(`[face] photo ${photoId} not found in event ${eventId} — skipping`);
      return;
    }

    // Verify r2Key is scoped to this event
    if (!r2Key.startsWith(`events/${eventId}/`)) {
      console.error(`[face] r2Key ${r2Key} does not belong to event ${eventId} — skipping`);
      await setPhotoStatus(photoId, "failed");
      return;
    }

    await setPhotoStatus(photoId, "processing");

    // ── 1. Fetch photo from R2 ──────────────────────────────────
    let photoBuffer;
    try {
      photoBuffer = await r2ToBuffer(r2Key);
    } catch (err) {
      console.error(`[face] R2 download failed for ${r2Key}:`, err.message);
      await setPhotoStatus(photoId, "failed");
      throw err;
    }

    // ── 1b. Resize photo before sending to InsightFace (performance) ──
    // Face detection does not need full 4K resolution.
    // Resizing to max 1500px wide is 3-4x faster and uses far less RAM.
    try {
      photoBuffer = await sharp(photoBuffer)
        .resize({ width: 1500, height: 1500, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch (resizeErr) {
      console.warn(`[face] Resize failed for ${photoId}, using original:`, resizeErr.message);
      // Continue with original buffer — don't fail the job
    }

    // ── 2. Send to InsightFace /embed-batch ─────────────────────
    const embedHeaders = {};
    if (process.env.INSIGHTFACE_API_KEY) {
      embedHeaders["x-api-key"] = process.env.INSIGHTFACE_API_KEY;
    }
    const form = new FormData();
    form.append("image", photoBuffer, { filename: "photo.jpg", contentType: "image/jpeg" });

    const embedRes = await fetch(`${process.env.INSIGHTFACE_SERVICE_URL}/embed-batch`, {
      method: "POST",
      body: form,
      headers: { ...form.getHeaders(), ...embedHeaders },
    });

    if (!embedRes.ok) {
      const errText = await embedRes.text();
      console.error(`[face] InsightFace error for ${photoId}:`, errText);
      await setPhotoStatus(photoId, "failed");
      return;
    }

    const { embeddings, face_count, faces: facesMetadata } = await embedRes.json();

    const MIN_DET_SCORE = parseFloat(process.env.MIN_FACE_DET_SCORE || "0.50");

    // Filter out low-confidence detections (reflections, partial faces, photos-of-photos)
    const validEmbeddings = embeddings.filter((_, i) => {
      const score = facesMetadata?.[i]?.det_score;
      return score === null || score === undefined || score >= MIN_DET_SCORE;
    });

    if (face_count === 0 || !validEmbeddings.length) {
      console.log(`[face] No valid face detected in photo ${photoId} (${face_count} raw, 0 above threshold)`);
      await setPhotoStatus(photoId, "no_face", { face_count: 0, processed_at: new Date().toISOString() });
      return;
    }

    // Delete old embeddings before insert (idempotent on retry)
    await supabase
      .from("face_embeddings")
      .delete()
      .eq("photo_id", photoId)
      .eq("event_id", eventId);

    // ── 4. Store all face embeddings in pgvector ────────────────
    const resolvedPhotographerId = photographerId || photoRow.photographer_id || null;
    const embeddingRows = validEmbeddings.map((embedding) => ({
      event_id: eventId,
      photo_id: photoId,
      photographer_id: resolvedPhotographerId,
      embedding: `[${embedding.join(",")}]`,
    }));

    const { error: embedErr } = await supabase
      .from("face_embeddings")
      .insert(embeddingRows);

    if (embedErr) {
      console.error(`[face] pgvector insert error for ${photoId}:`, embedErr.message);
      await setPhotoStatus(photoId, "failed");
      return;
    }

    // ── 5. Mark photo as processed ──────────────────────────────
    await setPhotoStatus(photoId, "processed", {
      face_count: validEmbeddings.length,
      processed_at: new Date().toISOString(),
    });

    console.log(`[face] ✓ Photo ${photoId} processed — ${validEmbeddings.length} valid face(s) indexed (${face_count} detected)`);
  },
  {
    connection: redis,
    concurrency: 4,
  }
);

faceWorker.on("failed", (job, err) => {
  console.error(`[face] Job ${job?.id} failed:`, err.message);
});

faceWorker.on("completed", (job) => {
  console.log(`[face] Job ${job.id} completed`);
});

// ══════════════════════════════════════════════════════════════════════════════
// WORKER 2: Zip Generation
// ══════════════════════════════════════════════════════════════════════════════
const zipWorker = new Worker(
  "zip-jobs",
  async (job) => {
    const { zipJobId, photoIds, eventId, guestEmail } = job.data;
    console.log(`[zip] Creating zip for job ${zipJobId} — ${photoIds.length} photos`);

    await supabase.from("zip_jobs").update({ status: "processing" }).eq("id", zipJobId);

    // ── 1. Fetch all photo records from DB — always filter by event_id ──
    const { data: photos, error: photosErr } = await supabase
      .from("event_photos")
      .select("id, r2_key, storage_path, original_filename")
      .in("id", photoIds)
      .eq("event_id", eventId);

    if (photosErr || !photos?.length) {
      await supabase.from("zip_jobs").update({ status: "failed" }).eq("id", zipJobId);
      throw new Error("Photos not found");
    }

    // ── 2. Download all photos from R2 and add to zip ───────────
    const zip = new JSZip();
    const CONCURRENCY = 6;
    let idx = 0;

    async function worker() {
      while (idx < photos.length) {
        const i = idx++;
        const photo = photos[i];
        const key = photo.r2_key || photo.storage_path;
        try {
          const buffer = await r2ToBuffer(key);
          const ext = key.split(".").pop() || "jpg";
          const filename = photo.original_filename || `event-photo-${String(i + 1).padStart(3, "0")}-${photo.id.slice(0, 8)}.${ext}`;
          zip.file(filename, buffer);
        } catch (err) {
          console.warn(`[zip] Failed to download ${key}:`, err.message);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, photos.length) }, worker));

    // ── 3. Generate zip buffer ───────────────────────────────────
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // ── 4. Upload zip to R2 ──────────────────────────────────────
    const zipKey = `zips/${zipJobId}.zip`;
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: zipKey,
      Body: zipBuffer,
      ContentType: "application/zip",
    }));

    const downloadUrl = `${process.env.R2_PUBLIC_URL}/${zipKey}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // ── 5. Update job status ─────────────────────────────────────
    await supabase.from("zip_jobs").update({
      status: "ready",
      r2_zip_key: zipKey,
      download_url: downloadUrl,
      expires_at: expiresAt,
    }).eq("id", zipJobId);

    console.log(`[zip] ✓ Zip ready for job ${zipJobId}: ${downloadUrl}`);

    // ── 6. Send email notification ───────────────────────────────
    if (guestEmail) {
      try {
        await resend.emails.send({
          from: "EventSnap <photos@eventsnap.in>",
          to: guestEmail,
          subject: "Your EventSnap photos are ready to download",
          html: `
            <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">✦ Your photos are ready!</h2>
              <p style="color:#555;line-height:1.6;margin-bottom:24px;">
                Your EventSnap photo pack is ready. Click below to download your photos.
              </p>
              <a href="${downloadUrl}" style="display:inline-block;background:#E8A830;color:#0D0A14;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;">
                Download My Photos →
              </a>
              <p style="color:#999;font-size:12px;margin-top:24px;">
                This link expires in 7 days. Powered by EventSnap.in
              </p>
            </div>
          `,
        });
        console.log(`[zip] Email sent to ${guestEmail}`);
      } catch (emailErr) {
        console.warn(`[zip] Email failed for ${guestEmail}:`, emailErr.message);
      }
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

zipWorker.on("failed", async (job, err) => {
  console.error(`[zip] Job ${job?.id} failed:`, err.message);
  if (job?.data?.zipJobId) {
    await supabase.from("zip_jobs").update({ status: "failed" }).eq("id", job.data.zipJobId);
  }
});

console.log("✦ EventSnap workers running:");
console.log("  - face-processing (concurrency: 4)");
console.log("  - zip-jobs        (concurrency: 2)");
