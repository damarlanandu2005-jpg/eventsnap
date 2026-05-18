/**
 * GET /api/download/zip/[jobId]
 *
 * Polls the status of an async zip job.
 * Returns: { status: "queued"|"processing"|"ready"|"failed", download_url?, expires_at? }
 */

import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ error: "jobId is required" });
  }

  const { data: job, error } = await supabaseAdmin
    .from("zip_jobs")
    .select("id, status, download_url, expires_at, created_at")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return res.status(404).json({ error: "Zip job not found" });
  }

  // If download URL has expired, mark as failed
  if (job.status === "ready" && job.expires_at && new Date(job.expires_at) < new Date()) {
    return res.status(410).json({ status: "expired", error: "Download link has expired. Please request a new download." });
  }

  return res.status(200).json({
    status: job.status,
    download_url: job.download_url || null,
    expires_at: job.expires_at || null,
  });
}
