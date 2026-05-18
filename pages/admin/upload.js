import { useState, useRef } from "react";
import Head from "next/head";

// ─────────────────────────────────────────────────────────────
// /admin/upload
//
// FIX: Secret is now stored in a useRef (secretRef) so it is
// never lost when the component re-renders after login.
// The previous bug: secret lived only in state — after
// setAuthed(true) triggered a re-render to show the upload
// form, the secret value was stale in the closure used by
// handleUpload. Now secretRef.current always has the value.
// ─────────────────────────────────────────────────────────────

export default function AdminUpload() {
  const fileInputRef = useRef(null);
  const secretRef = useRef("");       // ← stores secret permanently

  const [secretInput, setSecretInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [eventId, setEventId] = useState("default");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  function handleLogin() {
    if (!secretInput.trim()) return;
    secretRef.current = secretInput.trim(); // save to ref before re-render
    setAuthed(true);
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (selected.length === 0) return;
    setFiles(selected);
    setResults(null);
    setError("");

    // Generate previews
    const urls = selected.slice(0, 8).map((f) => URL.createObjectURL(f));
    setPreviews(urls);
  }

  async function handleUpload() {
    if (!files.length || uploading) return;

    setUploading(true);
    setError("");
    setResults(null);

    const allResults = [];
    const eid = eventId.trim() || "default";

    // Upload ONE photo at a time — Vercel has a 4.5MB body size limit
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append("event_id", eid);
      formData.append("photos", files[i]);

      try {
        const res = await fetch("/api/admin/index-photos", {
          method: "POST",
          headers: { "x-admin-secret": secretRef.current },
          body: formData,
        });

        let data;
        try {
          data = await res.json();
        } catch {
          allResults.push({
            file: files[i].name,
            success: false,
            error: `Server error (${res.status}). File may be too large (max ~4MB per photo).`,
          });
          continue;
        }

        if (data.results) {
          allResults.push(...data.results);
        } else {
          allResults.push({ file: files[i].name, success: false, error: data.error || "Upload failed" });
        }
      } catch (err) {
        allResults.push({ file: files[i].name, success: false, error: err.message });
      }
    }

    const successCount = allResults.filter((r) => r.success).length;
    const failCount = allResults.filter((r) => !r.success).length;

    setResults({
      success: true,
      message: `${successCount} photo(s) indexed, ${failCount} failed.`,
      results: allResults,
    });
    setFiles([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
  }

  // ── Login screen ────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <Head><title>Admin Login</title></Head>
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🔐</div>
              <h1 className="text-lg font-bold text-gray-900">Admin Access</h1>
              <p className="text-sm text-gray-400 mt-1">
                Enter the ADMIN_SECRET from your .env.local
              </p>
            </div>
            <input
              type="password"
              placeholder="Admin secret"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 mb-4"
              autoFocus
            />
            <button
              onClick={handleLogin}
              disabled={!secretInput.trim()}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                secretInput.trim()
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Login
            </button>
          </div>
        </main>
      </>
    );
  }

  // ── Upload screen ───────────────────────────────────────────
  return (
    <>
      <Head><title>Admin — Upload Event Photos</title></Head>
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Upload Event Gallery</h1>
              <p className="text-gray-400 text-sm mt-1">
                Photos are uploaded to R2 and queued for face indexing via the active provider (AWS Rekognition by default).
              </p>
            </div>
            <a
              href="/admin/dashboard"
              className="text-sm text-indigo-600 hover:underline"
            >
              Dashboard →
            </a>
          </div>

          {/* Event ID */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event ID
            </label>
            <input
              type="text"
              value={eventId}
              onChange={(e) =>
                setEventId(e.target.value.replace(/\s+/g, "-").toLowerCase())
              }
              placeholder="e.g. wedding-2024 or birthday-rahul"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Use a unique ID per event so you can purge face data per event later.
            </p>
          </div>

          {/* File picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Photos
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all"
            >
              {files.length > 0 ? (
                <div>
                  <p className="font-semibold text-indigo-600 text-lg">
                    {files.length} photo{files.length !== 1 ? "s" : ""} selected
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Click to change selection</p>
                </div>
              ) : (
                <div className="text-gray-400">
                  <div className="text-4xl mb-2">🖼️</div>
                  <p className="font-medium text-gray-600">Click to select event photos</p>
                  <p className="text-xs mt-1">JPG, PNG, HEIC & RAW (CR2/CR3/NEF/ARW/DNG…) — up to 1000 photos, 50MB each</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.rw2,.orf,.pef,.srw,.rwl,.dcr,.kdc,.x3f,.mrw,.3fr,.iiq,.heic,.heif"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Thumbnails */}
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {previews.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover border border-gray-100"
                  />
                ))}
                {files.length > 8 && (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
                    +{files.length - 8}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <p className="font-medium mb-1">Upload failed</p>
              <p>{error}</p>
              {error.includes("ADMIN_SECRET") && (
                <p className="mt-2 text-xs text-red-500">
                  → Open .env.local, add <code>ADMIN_SECRET=your-password</code>, then restart the server with <code>npm run dev</code>.
                </p>
              )}
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all mb-6 ${
              files.length && !uploading
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Uploading and indexing…
              </span>
            ) : (
              `Upload & Index ${files.length ? files.length + " " : ""}Photos`
            )}
          </button>

          {/* Results */}
          {results && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">
                  {results.results.every((r) => r.success) ? "🎉" : "⚠️"}
                </span>
                <div>
                  <h2 className="font-semibold text-gray-900">Upload complete</h2>
                  <p className="text-sm text-gray-500">{results.message}</p>
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {results.results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-sm p-3 rounded-xl ${
                      r.success ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <span className="mt-0.5">{r.success ? "✅" : "❌"}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-700 truncate">{r.file}</p>
                      <p className={`text-xs mt-0.5 ${r.success ? "text-green-600" : "text-red-500"}`}>
                        {r.success
                          ? `${r.facesIndexed} face(s) detected and indexed`
                          : r.error}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
