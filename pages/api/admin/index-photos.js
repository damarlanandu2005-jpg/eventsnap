import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import { supabaseAdmin } from "../../../lib/supabase";
import { r2Upload, r2Delete } from "../../../lib/r2";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 50 * 1024 * 1024,
      maxFiles: 1000,
      keepExtensions: true,
      allowEmptyFiles: false,
      multiples: true,
    });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function toArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function getField(fields, key) {
  const val = fields[key];
  if (!val) return null;
  return Array.isArray(val) ? val[0] : val;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const adminSecret = req.headers["x-admin-secret"];
  const expectedSecret = process.env.ADMIN_SECRET;

  if (!expectedSecret) {
    return res.status(500).json({
      success: false,
      error: "ADMIN_SECRET not configured.",
    });
  }

  if (!adminSecret || adminSecret.trim() !== expectedSecret.trim()) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized — wrong or missing admin secret.",
    });
  }

  try {
    let fields, files;
    try {
      ({ fields, files } = await parseForm(req));
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        error: "Failed to parse upload: " + parseErr.message,
      });
    }

    const eventIdOrSlug = getField(fields, "event_id") || "default";
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventIdOrSlug);
    let eventId;

    if (isUUID) {
      const { data: evData, error: evErr } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("id", eventIdOrSlug)
        .single();
      if (evErr || !evData) {
        return res.status(400).json({ success: false, error: `Event with ID '${eventIdOrSlug}' not found.` });
      }
      eventId = eventIdOrSlug;
    } else {
      const { data: evData, error: evErr } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", eventIdOrSlug)
        .single();
      if (evErr || !evData) {
        return res.status(400).json({ success: false, error: `Event '${eventIdOrSlug}' not found. Please create it first.` });
      }
      eventId = evData.id;
    }

    const photoFiles = toArray(files.photos);
    if (photoFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No photos received. Make sure the file input has name='photos'.",
      });
    }

    const results = [];
    const queueRows = [];

    for (const photoFile of photoFiles) {
      const tempPath = photoFile.filepath || photoFile.path;
      const originalName = photoFile.originalFilename || photoFile.name || "photo.jpg";
      const mimeType = photoFile.mimetype || photoFile.type || "image/jpeg";
      let r2PhotoKey = null;
      let r2ThumbKey = null;

      try {
        if (!mimeType.startsWith("image/")) {
          results.push({ file: originalName, success: false, error: "Not an image file" });
          continue;
        }

        const fileBuffer = fs.readFileSync(tempPath);
        const photoId = uuidv4();
        const ext = path.extname(originalName).toLowerCase() || ".jpg";

        // Upload to Cloudflare R2
        r2PhotoKey = `events/${eventId}/${photoId}${ext}`;
        try {
          await r2Upload(fileBuffer, r2PhotoKey, mimeType);
        } catch (uploadErr) {
          results.push({ file: originalName, success: false, error: "R2 storage error: " + uploadErr.message });
          continue;
        }

        // Generate and upload thumbnail
        try {
          const thumbBuffer = await sharp(fileBuffer)
            .resize(400, null, { withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
          r2ThumbKey = `events/${eventId}/thumbs/${photoId}.jpg`;
          await r2Upload(thumbBuffer, r2ThumbKey, "image/jpeg");
        } catch (thumbErr) {
          console.warn("Thumbnail failed:", originalName, thumbErr.message);
          r2ThumbKey = null;
        }

        // Save to DB — face indexing handled async via process-queue cron
        const { error: dbError } = await supabaseAdmin
          .from("event_photos")
          .insert({
            id: photoId,
            r2_key: r2PhotoKey,
            storage_path: r2PhotoKey,
            thumbnail_path: r2ThumbKey,
            original_filename: originalName,
            event_id: eventId,
            processing_status: "pending",
          });

        if (dbError) {
          await r2Delete(r2PhotoKey);
          if (r2ThumbKey) await r2Delete(r2ThumbKey);
          results.push({ file: originalName, success: false, error: "Database error: " + dbError.message });
          continue;
        }

        queueRows.push({
          event_id: eventId,
          storage_path: r2PhotoKey,
          original_filename: originalName,
          status: "pending",
          photo_id: photoId,
          upload_source: "r2",
        });

        results.push({ file: originalName, success: true, photoId, queued: true });
      } catch (err) {
        console.error("Error processing", originalName, ":", err.message);
        if (r2PhotoKey) await r2Delete(r2PhotoKey).catch(() => {});
        if (r2ThumbKey) await r2Delete(r2ThumbKey).catch(() => {});
        results.push({ file: originalName, success: false, error: err.message });
      } finally {
        if (tempPath && fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
      }
    }

    // Batch insert queue rows
    if (queueRows.length > 0) {
      const { error: queueError } = await supabaseAdmin
        .from("photo_processing_queue")
        .insert(queueRows);
      if (queueError) console.warn("Queue insert error:", queueError.message);
    }

    // Trigger processing (non-blocking)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
    fetch(`${appUrl}/api/cron/process-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "internal",
      },
      body: JSON.stringify({ secret: process.env.CRON_SECRET || "internal", eventId }),
    }).catch(() => {});

    const ok = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;

    return res.status(200).json({
      success: true,
      message: `${ok} photo(s) uploaded and queued for face indexing, ${fail} failed.`,
      results,
    });
  } catch (err) {
    console.error("index-photos error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
