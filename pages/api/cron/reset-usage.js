/**
 * GET /api/cron/reset-usage
 *
 * Monthly usage reset — runs at midnight on the 1st of each month.
 * Does not delete old rows (preserved for billing history).
 * New period rows are created on first usage via upsert in increment_photos_used().
 *
 * Vercel Cron schedule: "0 0 1 * *"
 */

import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req, res) {
  // ── Verify Vercel Cron secret ───────────────────────────────
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const periodStart = new Date().toISOString().slice(0, 7) + "-01";

    // Log the reset (new rows created on first usage of new month via upsert)
    console.log(`Usage reset triggered for period: ${periodStart}`);

    // Optionally: expire old zip jobs from previous months
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("zip_jobs")
      .delete()
      .lt("created_at", thirtyDaysAgo)
      .eq("status", "ready"); // Only clean up completed ones

    return res.status(200).json({
      ok: true,
      period: periodStart,
      message: "Usage reset complete. New period rows will be created on first usage.",
    });
  } catch (err) {
    console.error("Reset usage cron error:", err);
    return res.status(500).json({ error: err.message });
  }
}
