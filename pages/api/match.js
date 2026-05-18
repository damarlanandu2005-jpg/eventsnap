import { supabaseAdmin } from "../../lib/supabase";
import { r2Download, r2Delete, r2GetSignedUrl, r2PublicUrl } from "../../lib/r2";
import { searchByImage } from "../../lib/face";

// ─────────────────────────────────────────────────────────────
// POST /api/match
//
// Guest face matching using InsightFace + pgvector cosine similarity.
//
// Flow:
// 1. Validate the download token
// 2. Return cached results if already matched
// 3. Download selfie from Cloudflare R2
// 4. Send selfie to InsightFace /embed → 512-dim embedding
// 5. pgvector cosine similarity search via match_faces RPC
// 6. Look up matched photos in event_photos table
// 7. Generate signed/public URLs via R2 or Supabase storage
// 8. Save matched IDs + mark complete
// 9. Delete selfie from R2 (GDPR)
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: "Token is required." });
  }

  try {
    // ── Step 1: Validate token ────────────────────────────────
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("download_tokens")
      .select("*, match_requests(*)")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return res.status(404).json({
        success: false,
        error: "Invalid or expired link. Please upload your selfie again.",
      });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        error: "This link has expired (24 hour limit). Please upload your selfie again.",
        expired: true,
      });
    }

    const matchRequest = tokenRow.match_requests;

    // ── Step 2: Return cached results ────────────────────────
    if (matchRequest.status === "complete" && matchRequest.matched_photo_ids?.length > 0) {
      const cachedPhotos = await getPhotoUrls(matchRequest.matched_photo_ids, matchRequest.event_id);
      return res.status(200).json({
        success: true,
        photos: cachedPhotos,
        fromCache: true,
        message: `${cachedPhotos.length} photo(s) found.`,
      });
    }

    // ── Step 3: Mark as processing ────────────────────────────
    await supabaseAdmin
      .from("match_requests")
      .update({ status: "processing" })
      .eq("id", matchRequest.id);

    // ── Step 4: Download selfie from R2 ───────────────────────
    let selfieBuffer;
    try {
      selfieBuffer = await r2Download(matchRequest.selfie_path);
    } catch (downloadErr) {
      console.error("R2 selfie download error:", downloadErr);
      await updateStatus(matchRequest.id, "failed");
      return res.status(500).json({
        success: false,
        error: "Could not retrieve your selfie. Please upload again.",
      });
    }

    // ── Step 5: Run face search through the active provider ──
    let matches = [];
    try {
      const { data: ev } = await supabaseAdmin
        .from("events").select("photographer_id").eq("id", matchRequest.event_id).maybeSingle();
      const result = await searchByImage({
        eventId: matchRequest.event_id,
        imageBuffer: selfieBuffer,
        photographerId: ev?.photographer_id || null,
      });
      if (result.noFaceDetected) {
        await updateStatus(matchRequest.id, "complete");
        await deleteSelfie(matchRequest.selfie_path);
        return res.status(200).json({
          success: true,
          photos: [],
          noFaceDetected: true,
          message: "No face detected in your selfie. Please try a well-lit, front-facing photo.",
        });
      }
      matches = result.matches || [];
    } catch (faceErr) {
      console.error("Face provider error:", faceErr);
      await updateStatus(matchRequest.id, "failed");
      await deleteSelfie(matchRequest.selfie_path);
      return res.status(500).json({
        success: false,
        error: "Face matching failed. Please try again.",
      });
    }

    if (!matches || matches.length === 0) {
      await updateStatus(matchRequest.id, "complete");
      await deleteSelfie(matchRequest.selfie_path);
      return res.status(200).json({
        success: true,
        photos: [],
        message: "No matching photos found for you in this event's gallery.",
      });
    }

    // ── Step 7: Fetch photo records ───────────────────────────
    const uniquePhotoIds = [...new Set(matches.map((m) => m.photoId))];

    const { data: eventPhotos, error: photosError } = await supabaseAdmin
      .from("event_photos")
      .select("id, storage_path, r2_key, original_filename")
      .in("id", uniquePhotoIds)
      .eq("event_id", matchRequest.event_id)
      .eq("processing_status", "processed");

    if (photosError || !eventPhotos?.length) {
      await updateStatus(matchRequest.id, "failed");
      await deleteSelfie(matchRequest.selfie_path);
      return res.status(500).json({
        success: false,
        error: "Error retrieving matched photos.",
      });
    }

    // ── Step 8: Generate URLs ─────────────────────────────────
    const photos = await buildPhotoUrls(eventPhotos, matches);

    // ── Step 9: Save results + mark complete ──────────────────
    await supabaseAdmin
      .from("match_requests")
      .update({
        status: "complete",
        matched_photo_ids: eventPhotos.map((p) => p.id),
      })
      .eq("id", matchRequest.id);

    // ── Step 10: Delete selfie (GDPR) ─────────────────────────
    await deleteSelfie(matchRequest.selfie_path);

    return res.status(200).json({
      success: true,
      photos,
      message: `${photos.length} photo(s) found!`,
    });

  } catch (err) {
    console.error("Match handler error:", err);
    return res.status(500).json({
      success: false,
      error: "Something went wrong during matching. Please try again.",
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────

async function updateStatus(matchRequestId, status) {
  await supabaseAdmin
    .from("match_requests")
    .update({ status })
    .eq("id", matchRequestId);
}

async function deleteSelfie(selfiePath) {
  try {
    await r2Delete(selfiePath);
  } catch (err) {
    console.error("Selfie deletion error:", err);
  }
}

async function getPhotoUrls(photoIds, eventId) {
  let query = supabaseAdmin
    .from("event_photos")
    .select("id, storage_path, r2_key, original_filename")
    .in("id", photoIds);

  // Always filter by event_id to prevent cross-event data leaks
  if (eventId) query = query.eq("event_id", eventId);

  const { data: photos } = await query;
  if (!photos) return [];
  return buildPhotoUrls(photos, []);
}

async function buildPhotoUrls(eventPhotos, matches) {
  const SIGNED_URL_EXPIRY = 86400;
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  const urlResults = await Promise.all(
    eventPhotos.map(async (photo) => {
      try {
        let url = null;

        // Priority: pick by where the photo actually lives, not by env var
        // presence. R2 photos must have r2_key set; Supabase Storage photos
        // have only storage_path. The previous logic used the same R2 base
        // URL even when r2_key was null — pointing browsers at non-existent
        // R2 keys and breaking thumbnails + downloads.
        if (photo.r2_key) {
          url = publicBase
            ? `${publicBase}/${photo.r2_key}`
            : await r2GetSignedUrl(photo.r2_key, SIGNED_URL_EXPIRY);
        } else if (photo.storage_path) {
          const { data: signedData } = await supabaseAdmin.storage
            .from("event-photos")
            .createSignedUrl(photo.storage_path, SIGNED_URL_EXPIRY);
          url = signedData?.signedUrl || null;
        }

        if (!url) return null;

        const match = matches.find((m) => m.photoId === photo.id);
        return {
          id: photo.id,
          url,
          confidence: match?.similarity ? Math.round(match.similarity * 100) : null,
          filename: photo.original_filename || `event-photo-${photo.id.slice(0, 8)}.jpg`,
        };
      } catch (err) {
        console.error("Failed to get URL for", photo.storage_path, ":", err.message);
        return null;
      }
    })
  );

  return urlResults.filter(Boolean);
}
