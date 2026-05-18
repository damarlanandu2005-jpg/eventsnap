/**
 * GET /api/events/[eventId]/progress
 *
 * Returns photo processing progress for an event.
 * Requires JWT auth and event ownership.
 */

import { supabaseAdmin } from "../../../../lib/supabase";
import { requireAuth } from "../../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { photographer } = auth;

  const { eventId } = req.query;
  if (!eventId) {
    return res.status(400).json({ error: "eventId is required" });
  }

  // Verify event ownership
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, photographer_id")
    .eq("id", eventId)
    .single();

  if (!event || event.photographer_id !== photographer.id) {
    return res.status(403).json({ error: "Not authorized to view this event" });
  }

  const { data, error } = await supabaseAdmin
    .from("event_photos")
    .select("processing_status")
    .eq("event_id", eventId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const total = data?.length ?? 0;
  const processed = data?.filter((p) => p.processing_status === "processed").length ?? 0;
  const failed = data?.filter((p) => p.processing_status === "failed").length ?? 0;
  const noFace = data?.filter((p) => p.processing_status === "no_face").length ?? 0;
  const queued = data?.filter((p) => p.processing_status === "queued").length ?? 0;
  const processing = data?.filter((p) => p.processing_status === "processing").length ?? 0;
  const pending = total - processed - failed - noFace - queued - processing;
  const searchable = processed; // Only "processed" photos are matchable

  const percent = total > 0 ? Math.round(((processed + failed + noFace) / total) * 100) : 0;

  return res.status(200).json({
    total,
    uploaded: total,
    searchable,
    processed,
    failed,
    no_face: noFace,
    queued,
    processing,
    pending,
    percent,
    done: percent === 100,
  });
}
