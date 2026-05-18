/**
 * POST /api/admin/reindex
 *
 * Re-queues existing photos so the cron worker runs the active face provider
 * (AWS Rekognition by default) on each one. Use this after switching providers
 * to back-fill old events whose faces are only in pgvector.
 *
 * Auth: x-admin-secret header must match env ADMIN_SECRET.
 *
 * Body:
 *   { eventId?: string,            // UUID — limit to one event
 *     scope?: "all" | "missing",   // "missing" (default) = only photos
 *                                  //   with no rekognition_face_ids;
 *                                  // "all" = every processed/no_face photo
 *     dryRun?: boolean             // count, don't insert
 *   }
 *
 * Returns: { eligible, queued, dryRun, eventId }
 */

import { supabaseAdmin } from "@/lib/supabase";
import { providerName } from "@/lib/face";

const PAGE_SIZE = 500;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminSecret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { eventId = null, scope = "missing", dryRun = false } = req.body || {};

  if (!["missing", "all"].includes(scope)) {
    return res.status(400).json({ error: "scope must be 'missing' or 'all'" });
  }

  try {
    let eligible = 0;
    let queued = 0;
    let from = 0;

    // Walk event_photos in pages so we don't OOM on huge events.
    for (;;) {
      let query = supabaseAdmin
        .from("event_photos")
        .select("id, event_id, storage_path, r2_key, original_filename, processing_status, rekognition_face_ids")
        .order("uploaded_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (eventId) query = query.eq("event_id", eventId);

      // Only re-process photos we successfully stored. 'pending' rows are
      // already in the queue or are mid-flight — don't double-queue them.
      query = query.in("processing_status", ["processed", "no_face", "failed"]);

      const { data: rows, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      if (!rows?.length) break;

      const candidates = scope === "all"
        ? rows
        : rows.filter((r) => !Array.isArray(r.rekognition_face_ids) || r.rekognition_face_ids.length === 0);

      eligible += candidates.length;

      if (!dryRun && candidates.length > 0) {
        // Two writes per batch:
        //   1. event_photos.processing_status = 'pending' so the gallery
        //      shows the right state and the photo isn't matched against
        //      until it's been re-indexed.
        //   2. photo_processing_queue inserts (one row per photo) so the
        //      cron worker picks them up.
        const photoIds = candidates.map((c) => c.id);
        await supabaseAdmin
          .from("event_photos")
          .update({
            processing_status: "pending",
            processed_at: null,
            face_count: 0,
          })
          .in("id", photoIds);

        const queueRows = candidates.map((c) => ({
          event_id: c.event_id,
          storage_path: c.storage_path,
          original_filename: c.original_filename || "photo.jpg",
          status: "pending",
          photo_id: c.id,
          upload_source: c.r2_key ? "r2" : "supabase",
          attempts: 0,
        }));

        const { error: queueErr } = await supabaseAdmin
          .from("photo_processing_queue")
          .insert(queueRows);
        if (queueErr) return res.status(500).json({ error: queueErr.message });

        queued += candidates.length;
      }

      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Best-effort kick of the cron so the user doesn't wait for the next
    // confirm-upload trigger. Coalescing in confirm-upload protects against
    // running too many simultaneously.
    if (!dryRun && queued > 0 && process.env.CRON_SECRET) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
      fetch(`${appUrl}/api/cron/process-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET },
        body: JSON.stringify({ secret: process.env.CRON_SECRET, eventId, source: "admin_reindex" }),
      }).catch(() => {});
    }

    return res.status(200).json({
      eventId,
      scope,
      dryRun,
      provider: providerName,
      eligible,
      queued,
    });
  } catch (err) {
    console.error("[admin/reindex] error:", err);
    return res.status(500).json({ error: err.message });
  }
}
