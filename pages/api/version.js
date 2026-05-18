/**
 * GET /api/version
 *
 * Returns the current Vercel build ID. The client compares this to
 * window.__NEXT_DATA__.buildId on focus/visibilitychange — if they
 * differ, the bundle the browser is running is older than what the
 * server is serving, so a fresh deploy went out and the browser
 * should soft-reload to pick it up.
 *
 * Cheap to call (just reads an env var); cached to avoid generating
 * heat on hot dashboards.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=60');
  res.status(200).json({
    buildId: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
      || process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.NEXT_BUILD_ID
      || 'dev',
  });
}
