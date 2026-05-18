/**
 * GET /api/admin/analytics
 *
 * Returns real-time platform stats for the admin dashboard:
 *  - Counts: events, photos, photographers, guest scans
 *  - Revenue: derived from the purchases table
 *  - Infra cost: today / 7d / 30d, broken down by provider + operation
 *  - Top photographers by photos uploaded this month
 *  - Recent process-queue runs (so we can spot stalls)
 *
 * Auth: must present x-admin-secret matching env ADMIN_SECRET.
 */

import { supabaseAdmin } from "@/lib/supabase";

const DAY = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminSecret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();
    const since24h = new Date(now - 1 * DAY).toISOString();
    const since7d = new Date(now - 7 * DAY).toISOString();
    const since30d = new Date(now - 30 * DAY).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      eventsCount,
      photosCount,
      photographersCount,
      scansCount,
      pendingQueue,
      failedQueue,
      revenue,
      costSummary24h,
      costSummary30d,
      recentRuns,
      topPhotographers,
    ] = await Promise.all([
      countRows("events"),
      countRows("event_photos"),
      countRows("photographers"),
      countRows("match_requests"),
      countRows("photo_processing_queue", { column: "status", value: "pending" }),
      countRows("photo_processing_queue", { column: "status", value: "failed" }),
      sumPurchases(monthStart),
      costSummary(since24h),
      costSummary(since30d),
      fetchRecentRuns(),
      fetchTopPhotographers(monthStart),
    ]);

    res.status(200).json({
      counts: {
        events: eventsCount,
        photos: photosCount,
        photographers: photographersCount,
        guestScans: scansCount,
        pendingQueue,
        failedQueue,
      },
      revenue: {
        month_paise: revenue.month_paise,
        all_time_paise: revenue.all_time_paise,
        bySku: revenue.bySku,
      },
      cost: {
        last24h: costSummary24h,
        last30d: costSummary30d,
      },
      processQueue: {
        recentRuns,
      },
      topPhotographers,
    });
  } catch (error) {
    console.error("admin analytics error:", error);
    res.status(500).json({ error: error.message });
  }
}

async function countRows(table, filter) {
  let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count } = await query;
  return count || 0;
}

async function costSummary(sinceISO) {
  // Prefer the SQL aggregate RPC; fall back to client-side group-by if the
  // migration hasn't been applied yet.
  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("cost_summary", {
    p_since: sinceISO,
  });

  if (!rpcErr && Array.isArray(rpcData)) {
    return shapeCost(rpcData);
  }

  const { data: rows } = await supabaseAdmin
    .from("cost_events")
    .select("provider, operation, units, cost_paise")
    .gte("occurred_at", sinceISO);

  const map = new Map();
  for (const r of rows || []) {
    const key = `${r.provider}|${r.operation}`;
    const prev = map.get(key) || { provider: r.provider, operation: r.operation, units: 0, cost_paise: 0 };
    prev.units += Number(r.units) || 0;
    prev.cost_paise += Number(r.cost_paise) || 0;
    map.set(key, prev);
  }
  return shapeCost([...map.values()].sort((a, b) => b.cost_paise - a.cost_paise));
}

function shapeCost(rows) {
  const total_paise = rows.reduce((sum, r) => sum + Number(r.cost_paise || 0), 0);
  return {
    total_paise,
    items: rows.map((r) => ({
      provider: r.provider,
      operation: r.operation,
      units: Number(r.units || 0),
      cost_paise: Number(r.cost_paise || 0),
    })),
  };
}

async function sumPurchases(monthStartISO) {
  const { data: rows } = await supabaseAdmin
    .from("purchases")
    .select("sku, amount_paise, created_at, status")
    .eq("status", "paid");

  let month_paise = 0;
  let all_time_paise = 0;
  const bySku = new Map();

  for (const r of rows || []) {
    const amt = Number(r.amount_paise) || 0;
    all_time_paise += amt;
    if (r.created_at >= monthStartISO) month_paise += amt;
    bySku.set(r.sku, (bySku.get(r.sku) || 0) + amt);
  }

  return {
    month_paise,
    all_time_paise,
    bySku: [...bySku.entries()].map(([sku, amount_paise]) => ({ sku, amount_paise })),
  };
}

async function fetchRecentRuns() {
  const { data } = await supabaseAdmin
    .from("process_queue_runs")
    .select("id, started_at, finished_at, source, processed, succeeded, failed")
    .order("started_at", { ascending: false })
    .limit(10);
  return data || [];
}

async function fetchTopPhotographers(monthStartISO) {
  // event_photos.uploaded_at is the activity signal we have. We bucket
  // counts per photographer for the current month and join names back in.
  const { data: photos } = await supabaseAdmin
    .from("event_photos")
    .select("photographer_id, uploaded_at, file_size_bytes")
    .gte("uploaded_at", monthStartISO)
    .not("photographer_id", "is", null);

  if (!photos?.length) return [];

  const agg = new Map();
  for (const p of photos) {
    const prev = agg.get(p.photographer_id) || { photos: 0, bytes: 0 };
    prev.photos += 1;
    prev.bytes += Number(p.file_size_bytes) || 0;
    agg.set(p.photographer_id, prev);
  }

  const ids = [...agg.keys()];
  const { data: profiles } = await supabaseAdmin
    .from("photographers")
    .select("id, name, email, studio_name")
    .in("id", ids);

  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  return ids
    .map((id) => ({
      id,
      name: byId.get(id)?.studio_name || byId.get(id)?.name || byId.get(id)?.email || "Unknown",
      photos: agg.get(id).photos,
      bytes: agg.get(id).bytes,
    }))
    .sort((a, b) => b.photos - a.photos)
    .slice(0, 8);
}
