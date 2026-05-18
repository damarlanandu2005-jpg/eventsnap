import { supabaseAdmin } from "./supabase";
import { r2Delete } from "./r2";
import { deleteEventFaces, providerName } from "./face/index.js";

// ─────────────────────────────────────────────────────────────
// lib/cleanup.js — GDPR-compliant data deletion
//
// Called by:
//   - /api/admin/run-cleanup  (manual trigger)
//   - /api/cron/cleanup       (daily at 2am IST)
//
// Deletes:
//   1. Orphaned selfies from R2 older than 24h
//   2. match_requests older than 30 days (cascade-deletes tokens)
//   3. Expired download_tokens
//   4. Face embeddings for a specific event (on explicit purge request)
// ─────────────────────────────────────────────────────────────


// ── 1. Delete orphaned selfies older than 24 hours ───────────
export async function deleteOrphanedSelfies() {
  const results = { deleted: 0, errors: [] };

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: staleRequests, error } = await supabaseAdmin
      .from("match_requests")
      .select("id, selfie_path")
      .lt("created_at", cutoff)
      .not("selfie_path", "is", null)
      .neq("status", "complete");

    if (error) {
      results.errors.push("DB query error: " + error.message);
      return results;
    }

    if (!staleRequests?.length) return results;

    const paths = staleRequests.map((r) => r.selfie_path).filter(Boolean);

    // Selfies are stored in R2 (selfies/{uuid}.jpg)
    await Promise.allSettled(paths.map((p) => r2Delete(p)));
    results.deleted = paths.length;

    await supabaseAdmin
      .from("match_requests")
      .update({ selfie_path: null })
      .in("id", staleRequests.map((r) => r.id));

  } catch (err) {
    results.errors.push(err.message);
  }

  return results;
}


// ── 2. Delete match_requests older than 30 days ──────────────
export async function deleteOldMatchRequests(daysOld = 30) {
  const results = { deleted: 0, errors: [] };

  try {
    const cutoff = new Date(
      Date.now() - daysOld * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("match_requests")
      .delete()
      .lt("created_at", cutoff)
      .select("id");

    if (error) {
      results.errors.push("DB delete error: " + error.message);
      return results;
    }

    results.deleted = data?.length || 0;
  } catch (err) {
    results.errors.push(err.message);
  }

  return results;
}


// ── 3. Delete expired download tokens ────────────────────────
export async function deleteExpiredTokens() {
  const results = { deleted: 0, errors: [] };

  try {
    const { data, error } = await supabaseAdmin
      .from("download_tokens")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) {
      results.errors.push("Token delete error: " + error.message);
      return results;
    }

    results.deleted = data?.length || 0;
  } catch (err) {
    results.errors.push(err.message);
  }

  return results;
}


// ── 4. Purge face data for an event (GDPR biometric data) ─
// Removes face data through whichever provider is active:
//   - AWS Rekognition: deletes the per-event collection
//   - InsightFace: deletes embeddings from pgvector
// Also clears event_photos.rekognition_face_ids and resets processing_status
// so photos can be re-indexed cleanly. Does NOT delete the photos themselves.
export async function purgeFaceEmbeddings(eventId = null) {
  const results = { deleted: 0, provider: providerName, errors: [] };

  try {
    // Always wipe the pgvector rows — they may exist from a prior InsightFace
    // run even when AWS is the current provider.
    let query = supabaseAdmin.from("face_embeddings").delete().select("id");
    if (eventId) query = query.eq("event_id", eventId);
    const { data, error } = await query;
    if (error) {
      results.errors.push("Embedding delete error: " + error.message);
    } else {
      results.deleted = data?.length || 0;
    }

    if (eventId) {
      try {
        await deleteEventFaces(eventId);
      } catch (providerErr) {
        results.errors.push("Provider delete error: " + providerErr.message);
      }

      await supabaseAdmin
        .from("event_photos")
        .update({
          processing_status: "pending",
          face_count: 0,
          processed_at: null,
          rekognition_face_ids: [],
        })
        .eq("event_id", eventId)
        .eq("processing_status", "processed");
    }
  } catch (err) {
    results.errors.push(err.message);
  }

  return results;
}


// ── Master cleanup: runs all tasks in sequence ────────────────
export async function runFullCleanup() {
  const startTime = Date.now();
  const report = {
    ranAt: new Date().toISOString(),
    tasks: {},
    durationMs: 0,
  };

  report.tasks.orphanedSelfies = await deleteOrphanedSelfies();
  report.tasks.expiredTokens = await deleteExpiredTokens();
  report.tasks.oldMatchRequests = await deleteOldMatchRequests(30);

  report.durationMs = Date.now() - startTime;
  return report;
}
