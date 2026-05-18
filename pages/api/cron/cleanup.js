import { runFullCleanup } from "../../../lib/cleanup";

// ─────────────────────────────────────────────────────────────
// /api/cron/cleanup
//
// Vercel Cron Job endpoint — runs daily at 2am IST (8:30pm UTC)
// Configured in vercel.json (see root of project)
//
// Security: Vercel passes a secret Authorization header
// automatically for cron jobs. We verify it here so no one
// can trigger cleanup manually via a random HTTP request.
//
// To trigger manually for testing:
//   curl -X GET https://yourapp.vercel.app/api/cron/cleanup \
//     -H "Authorization: Bearer YOUR_CRON_SECRET"
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Only allow GET (Vercel cron) — not POST
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify the cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[Cron] Starting daily cleanup...");
    const report = await runFullCleanup();
    console.log("[Cron] Cleanup complete:", JSON.stringify(report));

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (err) {
    console.error("[Cron] Cleanup failed:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
