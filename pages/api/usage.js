/**
 * GET /api/usage
 *
 * Returns the current photographer's usage for the current billing period
 * alongside their active subscription plan limits.
 *
 * Returns: { usage: { events_used, photos_used, scans_used }, plan: { ... } }
 */

import { supabaseAdmin } from "../../lib/supabase";
import { DEFAULT_PLAN } from "../../lib/pricing";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user }, error: authErr } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null }, error: "no token" };

  if (authErr || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const periodStart = new Date().toISOString().slice(0, 7) + "-01";

  const [{ data: usage }, { data: plan }] = await Promise.all([
    supabaseAdmin
      .from("usage_ledger")
      .select("events_used, photos_used, scans_used")
      .eq("photographer_id", user.id)
      .eq("period_start", periodStart)
      .maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("plan_name, events_per_month, photos_per_event, scans_per_event")
      .eq("photographer_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  return res.status(200).json({
    usage: usage || { events_used: 0, photos_used: 0, scans_used: 0 },
    plan: plan || DEFAULT_PLAN,
    period_start: periodStart,
  });
}
