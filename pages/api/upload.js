import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../../lib/supabase";
import { r2Upload, r2Delete } from "../../lib/r2";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 50 * 1024 * 1024, // 50MB — also covers RAW selfies
      keepExtensions: true,
      allowEmptyFiles: false,
    });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function getField(fields, key) {
  const val = fields[key];
  if (!val) return null;
  return Array.isArray(val) ? val[0] : val;
}

function getFile(files, key) {
  const val = files[key];
  if (!val) return null;
  return Array.isArray(val) ? val[0] : val;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  let tempFilePath = null;
  let r2Key = null;

  try {
    let fields, files;
    try {
      ({ fields, files } = await parseForm(req));
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        error: "Upload failed: " + parseErr.message,
      });
    }

    // Validate consent
    const consent = getField(fields, "consent");
    if (consent !== "true") {
      return res.status(400).json({ success: false, error: "Consent is required." });
    }

    // Get selfie file
    const selfieFile = getFile(files, "selfie");
    if (!selfieFile) {
      return res.status(400).json({ success: false, error: "No selfie file received. Please take or upload a photo." });
    }

    tempFilePath = selfieFile.filepath || selfieFile.path;
    const mimeType = selfieFile.mimetype || selfieFile.type || "image/jpeg";
    const originalName = selfieFile.originalFilename || selfieFile.name || "selfie.jpg";

    if (!mimeType.startsWith("image/")) {
      return res.status(400).json({ success: false, error: "File must be an image (JPG, PNG, etc.)" });
    }

    // Validate file exists and has content
    if (!fs.existsSync(tempFilePath)) {
      return res.status(400).json({ success: false, error: "Selfie file not received properly. Please try again." });
    }

    const fileStats = fs.statSync(tempFilePath);
    if (fileStats.size < 1000) {
      return res.status(400).json({ success: false, error: "Image file is too small or corrupted. Please take a clearer photo." });
    }

    // Get event_slug
    const eventSlug = getField(fields, "event_slug") || null;
    let eventId = null;

    if (eventSlug) {
      const { data: evData } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", eventSlug)
        .single();
      eventId = evData?.id || null;
    }

    // ── Upload selfie to Cloudflare R2 ──────────────────────────────────────
    const ext = path.extname(originalName).toLowerCase() || ".jpg";
    const fileName = `${uuidv4()}${ext}`;
    r2Key = `selfies/${fileName}`;
    const fileBuffer = fs.readFileSync(tempFilePath);

    try {
      await r2Upload(fileBuffer, r2Key, mimeType);
    } catch (uploadErr) {
      console.error("R2 selfie upload error:", uploadErr);
      return res.status(500).json({
        success: false,
        error: "Failed to save your photo. Please try again. (" + uploadErr.message + ")",
      });
    }

    // ── Create match_request record ─────────────────────────────────────────
    const matchRequestId = uuidv4();
    const { error: dbError } = await supabaseAdmin
      .from("match_requests")
      .insert({
        id: matchRequestId,
        event_id: eventId,
        selfie_path: r2Key,   // stored as R2 key, e.g. "selfies/uuid.jpg"
        status: "pending",
        consent_given: true,
      });

    if (dbError) {
      console.error("DB match_request error:", dbError);
      // Rollback: remove selfie from R2
      await r2Delete(r2Key);
      return res.status(500).json({ success: false, error: "Database error. Please try again." });
    }

    // ── Create download token (24h) ─────────────────────────────────────────
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabaseAdmin
      .from("download_tokens")
      .insert({
        id: uuidv4(),
        match_request_id: matchRequestId,
        token,
        expires_at: expiresAt,
        used: false,
      });

    if (tokenError) {
      console.error("Token insert error:", tokenError);
      return res.status(500).json({ success: false, error: "Failed to create download link." });
    }

    // Cleanup temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }

    return res.status(200).json({ success: true, token, matchRequestId });

  } catch (err) {
    console.error("Upload handler error:", err);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    return res.status(500).json({ success: false, error: "Something went wrong: " + err.message });
  }
}
