import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// ─────────────────────────────────────────────────────────────
// /admin/dashboard
//
// Realtime ops dashboard — counts, revenue, infrastructure cost, recent
// processing runs, top photographers, plus GDPR cleanup / per-event face
// data purge controls.
//
// All numbers come from /api/admin/analytics and refresh every 15s while
// the tab is focused. No mock data anywhere.
// ─────────────────────────────────────────────────────────────

const REFRESH_MS = 15_000;

export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [purgeEventId, setPurgeEventId] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  const [actionError, setActionError] = useState("");

  const [reindexEventId, setReindexEventId] = useState("");
  const [reindexScope, setReindexScope] = useState("missing");
  const [reindexLoading, setReindexLoading] = useState(false);
  const [reindexResult, setReindexResult] = useState(null);

  const refresh = useCallback(async () => {
    if (!secret) return;
    try {
      const res = await fetch("/api/admin/analytics", {
        headers: { "x-admin-secret": secret },
      });
      if (res.status === 401) {
        setFetchError("Incorrect admin secret.");
        setAuthed(false);
        return;
      }
      if (!res.ok) {
        setFetchError(`Analytics fetch failed (HTTP ${res.status}).`);
        return;
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setFetchError("");
    } catch (err) {
      setFetchError(err.message);
    }
  }, [secret]);

  useEffect(() => {
    if (!authed) return;
    refresh();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [authed, refresh]);

  // ── Auth gate ───────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <Head><title>Admin Login</title></Head>
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🔐</div>
              <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && secret && setAuthed(true)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 mb-4"
            />
            <button
              onClick={() => secret && setAuthed(true)}
              disabled={!secret}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${secret ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
            >
              Login
            </button>
            {fetchError && <p className="mt-3 text-xs text-red-500 text-center">{fetchError}</p>}
          </div>
        </main>
      </>
    );
  }

  // ── Cleanup handler ─────────────────────────────────────────
  async function runCleanup() {
    setCleanupLoading(true);
    setCleanupResult(null);
    setActionError("");
    try {
      const res = await fetch("/api/admin/run-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action: "cleanup" }),
      });
      const out = await res.json();
      if (!out.success) setActionError(out.error);
      else setCleanupResult(out.report);
    } catch (err) {
      setActionError(err.message);
    }
    setCleanupLoading(false);
  }

  // ── Re-index handler ────────────────────────────────────────
  async function runReindex(dryRun) {
    setReindexLoading(true);
    setReindexResult(null);
    setActionError("");
    try {
      const res = await fetch("/api/admin/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({
          eventId: reindexEventId.trim() || null,
          scope: reindexScope,
          dryRun,
        }),
      });
      const out = await res.json();
      if (!res.ok) setActionError(out.error || "Re-index failed");
      else setReindexResult(out);
    } catch (err) {
      setActionError(err.message);
    }
    setReindexLoading(false);
  }

  // ── Purge handler ───────────────────────────────────────────
  async function runPurge() {
    if (!purgeEventId.trim()) return;
    if (!confirm(`Purge ALL face data for event "${purgeEventId}"? This cannot be undone.`)) return;
    setPurgeLoading(true);
    setPurgeResult(null);
    setActionError("");
    try {
      const res = await fetch("/api/admin/run-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action: "purge", eventId: purgeEventId }),
      });
      const out = await res.json();
      if (!out.success) setActionError(out.error);
      else setPurgeResult(out.result);
    } catch (err) {
      setActionError(err.message);
    }
    setPurgeLoading(false);
  }

  const counts = data?.counts || {};
  const revenue = data?.revenue || {};
  const cost24h = data?.cost?.last24h || { total_paise: 0, items: [] };
  const cost30d = data?.cost?.last30d || { total_paise: 0, items: [] };
  const runs = data?.processQueue?.recentRuns || [];
  const top = data?.topPhotographers || [];

  // Derived: 30d revenue margin (revenue this month minus 30d cost).
  const marginPaise = (revenue.month_paise || 0) - (cost30d.total_paise || 0);

  return (
    <>
      <Head><title>Admin Dashboard</title></Head>
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                {lastUpdated
                  ? `Live · last refreshed ${lastUpdated.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`
                  : "Loading…"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="bg-white border border-gray-200 hover:border-gray-300 text-sm font-semibold px-3 py-2 rounded-xl transition-all"
              >
                ↻ Refresh
              </button>
              <a href="/admin/upload" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
                + Upload Photos
              </a>
            </div>
          </div>

          {fetchError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {fetchError}
            </div>
          )}

          {/* Top-line stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Events" value={counts.events} bg="bg-indigo-50" color="text-indigo-700" />
            <StatCard label="Photos" value={counts.photos} bg="bg-purple-50" color="text-purple-700" />
            <StatCard label="Photographers" value={counts.photographers} bg="bg-emerald-50" color="text-emerald-700" />
            <StatCard label="Guest scans" value={counts.guestScans} bg="bg-amber-50" color="text-amber-700" />
          </div>

          {/* Revenue + cost — the two halves of the P&L */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-700">Revenue this month</h3>
                <span className="text-xs text-gray-400">Paid purchases</span>
              </div>
              <p className="text-3xl font-bold text-emerald-600">{formatINR(revenue.month_paise || 0)}</p>
              <p className="text-xs text-gray-400 mt-1">All time: {formatINR(revenue.all_time_paise || 0)}</p>
              {(revenue.bySku || []).length > 0 && (
                <div className="mt-3 space-y-1 text-xs">
                  {revenue.bySku.map((row) => (
                    <div key={row.sku} className="flex justify-between text-gray-500">
                      <span className="font-mono">{row.sku}</span>
                      <span>{formatINR(row.amount_paise)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-700">Infra cost</h3>
                <span className="text-xs text-gray-400">live</span>
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <p className="text-2xl font-bold text-rose-600">{formatINR(cost24h.total_paise)}</p>
                  <p className="text-xs text-gray-400">last 24h</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-rose-500">{formatINR(cost30d.total_paise)}</p>
                  <p className="text-xs text-gray-400">last 30 days</p>
                </div>
              </div>
              <p className={`mt-3 text-xs font-medium ${marginPaise >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                Estimated 30d margin: {formatINR(marginPaise)}
              </p>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost breakdown — last 30 days</h3>
            {cost30d.items.length === 0 ? (
              <p className="text-sm text-gray-400">No infra calls recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="pb-2 pr-3 font-medium">Provider</th>
                      <th className="pb-2 pr-3 font-medium">Operation</th>
                      <th className="pb-2 pr-3 font-medium text-right">Calls</th>
                      <th className="pb-2 pl-3 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cost30d.items.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-2 pr-3 text-gray-700">{row.provider}</td>
                        <td className="py-2 pr-3 text-gray-700 font-mono text-xs">{row.operation}</td>
                        <td className="py-2 pr-3 text-right text-gray-700">{row.units.toLocaleString("en-IN")}</td>
                        <td className="py-2 pl-3 text-right font-semibold text-rose-600">{formatINR(row.cost_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Queue health + top photographers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Processing queue</h3>
              <div className="flex gap-3 mb-3">
                <Mini label="Pending" value={counts.pendingQueue} color="text-amber-600" />
                <Mini label="Failed" value={counts.failedQueue} color="text-rose-600" />
              </div>
              <p className="text-xs text-gray-500 mb-2">Recent runs</p>
              {runs.length === 0 ? (
                <p className="text-xs text-gray-400">No runs yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {runs.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono text-gray-700">{r.processed}</span>{" "}
                        <span className="text-gray-400">/ {r.succeeded}✓ {r.failed}✗</span>
                        <span className="ml-2 text-gray-400">{r.source}</span>
                      </div>
                      <span className={r.finished_at ? "text-gray-400" : "text-amber-600 font-semibold"}>
                        {r.finished_at ? new Date(r.started_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "running…"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top photographers (this month)</h3>
              {top.length === 0 ? (
                <p className="text-xs text-gray-400">No uploads yet this month.</p>
              ) : (
                <div className="space-y-2">
                  {top.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate">{p.name}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{p.photos.toLocaleString("en-IN")} photos · {formatBytes(p.bytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* GDPR Cleanup */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-1">GDPR Cleanup</h2>
            <p className="text-sm text-gray-400 mb-4">
              Runs automatically every night at 2am. Deletes orphaned selfies,
              expired tokens, and match records older than 30 days.
            </p>

            {actionError && (
              <div className="mb-3 p-3 bg-red-50 rounded-lg text-sm text-red-600">{actionError}</div>
            )}

            <button
              onClick={runCleanup}
              disabled={cleanupLoading}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                cleanupLoading ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800 text-white"
              }`}
            >
              {cleanupLoading ? "Running…" : "Run Cleanup Now"}
            </button>

            {cleanupResult && (
              <div className="mt-4 bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <p className="font-medium text-gray-700">Cleanup complete in {cleanupResult.durationMs}ms</p>
                <p className="text-gray-500">🗑 Orphaned selfies deleted: {cleanupResult.tasks?.orphanedSelfies?.deleted ?? 0}</p>
                <p className="text-gray-500">🗑 Expired tokens deleted: {cleanupResult.tasks?.expiredTokens?.deleted ?? 0}</p>
                <p className="text-gray-500">🗑 Old match records deleted: {cleanupResult.tasks?.oldMatchRequests?.deleted ?? 0}</p>
              </div>
            )}
          </div>

          {/* Re-index */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-1">Re-index Photos</h2>
            <p className="text-sm text-gray-400 mb-4">
              Re-queue existing photos so the cron pushes them through the active
              face provider. Use this after switching providers — for example,
              to back-fill events that were originally indexed via InsightFace
              into the AWS Rekognition collection so guest search starts matching again.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3">
              <input
                type="text"
                placeholder="Event ID (UUID) — leave blank for all events"
                value={reindexEventId}
                onChange={(e) => setReindexEventId(e.target.value)}
                className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <select
                value={reindexScope}
                onChange={(e) => setReindexScope(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 bg-white"
              >
                <option value="missing">Scope: missing only</option>
                <option value="all">Scope: every photo</option>
              </select>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => runReindex(true)}
                disabled={reindexLoading}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  reindexLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white border border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {reindexLoading ? "…" : "Dry run (count only)"}
              </button>
              <button
                onClick={() => runReindex(false)}
                disabled={reindexLoading}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  reindexLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {reindexLoading ? "Queuing…" : "Re-queue photos"}
              </button>
            </div>

            {reindexResult && (
              <div className="mt-4 bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <p className="text-gray-700">
                  <strong>{reindexResult.eligible}</strong> photos eligible
                  {reindexResult.dryRun
                    ? " (dry run, nothing changed)"
                    : <> · <strong>{reindexResult.queued}</strong> re-queued for <span className="font-mono">{reindexResult.provider}</span></>}
                </p>
                {!reindexResult.dryRun && reindexResult.queued > 0 && (
                  <p className="text-xs text-gray-500">Cron has been kicked — photos will reappear as "processed" once Rekognition has indexed them.</p>
                )}
              </div>
            )}
          </div>

          {/* Face data purge */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-1">Purge Event Face Data</h2>
            <p className="text-sm text-gray-400 mb-4">
              After an event ends, permanently delete face data (AWS Rekognition collection or
              InsightFace / pgvector embeddings) for that event. Irreversible and required
              for GDPR compliance.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Event ID (UUID)"
                value={purgeEventId}
                onChange={(e) => setPurgeEventId(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
              <button
                onClick={runPurge}
                disabled={!purgeEventId.trim() || purgeLoading}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  purgeEventId.trim() && !purgeLoading ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {purgeLoading ? "Purging…" : "Purge"}
              </button>
            </div>
            {purgeResult && (
              <p className="mt-3 text-sm text-green-600">
                ✅ {purgeResult.deleted} face record(s) deleted ({purgeResult.provider}).
              </p>
            )}
          </div>

        </div>
      </main>
    </>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{(value || 0).toLocaleString("en-IN")}</p>
    </div>
  );
}

function Mini({ label, value, color }) {
  return (
    <div className="flex-1 bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{(value || 0).toLocaleString("en-IN")}</p>
    </div>
  );
}

function formatINR(paise) {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
}

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
