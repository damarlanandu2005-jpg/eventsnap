/**
 * POST /api/download/zip
 *
 * Handles bulk download requests for matched event photos.
 *
 * For ≤20 photos: returns direct R2 URLs for client-side JSZip.
 * For >20 photos: enqueues async zip job on Railway worker,
 *                  returns jobId for polling.
 *
 * Body: { photoIds: string[], eventId: string, guestEmail?: string }
 */

// bullmq + ioredis are imported lazily below so the small-pack code path
// (which just returns signed URLs) doesn't pay the cold-start parse cost
// when the photographer downloads ≤20 photos.
import { supabaseAdmin } from "../../../lib/supabase";

const SMALL_PACK_THRESHOLD = 20;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { photoIds, eventId, guestEmail } = req.body;

  if (!photoIds?.length || !eventId) {
    return res.status(400).json({ error: "Missing photoIds or eventId" });
  }

  // ── Small pack — return public/signed URLs for client-side zip ──
  if (photoIds.length <= SMALL_PACK_THRESHOLD) {
    const { data: photos } = await supabaseAdmin
      .from("event_photos")
      .select("id, r2_key, storage_path, original_filename")
      .in("id", photoIds);

    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

    // Batch-sign Supabase Storage paths so non-R2 photos work too.
    const supabasePaths = (photos || [])
      .filter((p) => !p.r2_key && p.storage_path)
      .map((p) => p.storage_path);
    const signedByPath = new Map();
    if (supabasePaths.length > 0) {
      try {
        const { data: signed } = await supabaseAdmin.storage
          .from("event-photos")
          .createSignedUrls(supabasePaths, 86400);
        for (const row of signed || []) {
          if (row?.path && row?.signedUrl) signedByPath.set(row.path, row.signedUrl);
        }
      } catch (e) {
        console.error("zip.js Supabase signed URL error:", e.message);
      }
    }

    const urls = (photos || []).map((p) => {
      let url = null;
      if (p.r2_key && publicBase) {
        url = `${publicBase}/${p.r2_key}`;
      } else if (p.storage_path) {
        url = signedByPath.get(p.storage_path) || null;
      }
      return {
        id: p.id,
        url,
        filename: p.original_filename || `event-photo-${p.id.slice(0, 8)}.jpg`,
      };
    }).filter((u) => u.url);

    return res.status(200).json({ mode: "client_zip", urls });
  }

  // ── Large pack — queue async zip job ─────────────────────────
  const { data: job, error: dbErr } = await supabaseAdmin
    .from("zip_jobs")
    .insert({
      event_id: eventId,
      photo_ids: photoIds,
      status: "queued",
    })
    .select()
    .single();

  if (dbErr || !job) {
    return res.status(500).json({ error: "Failed to create zip job. Please try again." });
  }

  // Enqueue on Railway BullMQ worker (loaded lazily — only large packs pay
  // the bullmq + ioredis parse cost).
  const { Queue } = await import("bullmq");
  const { createRedisConnection, closeRedis } = await import("../../../lib/redis");
  const redis = createRedisConnection();
  try {
    const queue = new Queue("zip-jobs", { connection: redis });
    await queue.add("create-zip", {
      zipJobId: job.id,
      photoIds,
      eventId,
      guestEmail: guestEmail || null,
    });
    await queue.close();
  } finally {
    await closeRedis(redis);
  }

  return res.status(200).json({
    mode: "async_zip",
    jobId: job.id,
    message: "Your zip is being prepared. You can check back in a few seconds.",
  });
}
