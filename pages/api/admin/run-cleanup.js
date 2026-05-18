import { runFullCleanup, purgeFaceEmbeddings } from "../../../lib/cleanup";
import { supabaseAdmin } from "../../../lib/supabase";

// ─────────────────────────────────────────────────────────────
// /api/admin/run-cleanup
//
// Manual cleanup trigger for the admin dashboard.
//
// POST body options:
//   { action: "cleanup" }               → full GDPR cleanup
//   { action: "purge", eventId: "slug" } → purge face embeddings
//                                          for one event (biometric data)
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminSecret = req.headers["x-admin-secret"];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const { action, eventId } = req.body || {};

  try {
    if (action === "purge") {
      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: "eventId (slug) is required for purge action.",
        });
      }

      // Accept either UUID or slug. The admin dashboard prompts for a UUID;
      // legacy admins may still paste a slug.
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
      const lookupCol = looksLikeUuid ? "id" : "slug";

      const { data: eventData, error: eventError } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq(lookupCol, eventId)
        .single();

      if (eventError || !eventData) {
        return res.status(400).json({ success: false, error: `Event '${eventId}' not found.` });
      }

      const result = await purgeFaceEmbeddings(eventData.id);
      return res.status(200).json({ success: true, action: "purge", result });
    }

    const report = await runFullCleanup();
    return res.status(200).json({ success: true, action: "cleanup", report });

  } catch (err) {
    console.error("Admin cleanup error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
