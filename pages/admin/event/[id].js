import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function AdminEventDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);

  // Get secret from sessionStorage (set during admin login)
  const getSecret = () =>
    typeof window !== 'undefined' ? sessionStorage.getItem('admin_secret') || '' : '';

  useEffect(() => {
    if (id) fetchEventDetails();
  }, [id]);

  const fetchEventDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events`, {
        headers: { 'x-admin-secret': getSecret() },
      });
      if (res.ok) {
        const data = await res.json();
        const ev = data.find((e) => e.id === id);
        if (ev) setEvent(ev);
        else router.push('/admin');
      } else {
        router.push('/admin');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadResults(null);

    const allResults = [];

    // Upload ONE photo at a time to stay within Vercel's 4.5MB body limit.
    // Batching all photos in one request causes "Request Entity Too Large".
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`Uploading photo ${i + 1} of ${files.length}...`);

      const formData = new FormData();
      formData.append('event_id', id);
      formData.append('photos', files[i]);

      try {
        const res = await fetch('/api/admin/index-photos', {
          method: 'POST',
          headers: { 'x-admin-secret': getSecret() },
          body: formData,
        });

        let data;
        try {
          data = await res.json();
        } catch {
          // Server returned non-JSON (e.g. Vercel size limit error)
          allResults.push({
            file: files[i].name,
            success: false,
            error: `Server error (${res.status}). File may be too large.`,
          });
          continue;
        }

        if (res.ok && data.results) {
          allResults.push(...data.results);
        } else {
          allResults.push({
            file: files[i].name,
            success: false,
            error: data.error || 'Upload failed',
          });
        }
      } catch (err) {
        allResults.push({ file: files[i].name, success: false, error: err.message });
      }
    }

    setUploadResults(allResults);
    setUploading(false);
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchEventDetails();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this event? All photos and matches will be removed permanently.')) return;
    try {
      const res = await fetch('/api/admin/events', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': getSecret(),
        },
        body: JSON.stringify({ eventId: id }),
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        const data = await res.json();
        alert(data.error || 'Delete failed');
      }
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading...
      </div>
    );
  if (!event) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <Head>
        <title>{event.name} - Admin - EventSnap</title>
      </Head>

      <nav className="border-b border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-white/50 hover:text-white">
              ← Back
            </Link>
            <span className="font-bold text-lg text-violet-400">EventSnap Admin</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{event.name}</h1>
            <p className="text-white/50 mt-1">
              Slug: /{event.slug}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            Delete Event
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <p className="text-white/50 text-sm mb-1">Total Photos</p>
            <p className="text-3xl font-bold">{event.event_photos?.[0]?.count || 0}</p>
          </div>
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <p className="text-white/50 text-sm mb-1">Status</p>
            <p className={`text-xl font-bold ${event.is_active ? 'text-green-400' : 'text-white/50'}`}>
              {event.is_active ? 'Active' : 'Inactive'}
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <p className="text-white/50 text-sm mb-1">Created</p>
            <p className="text-xl font-bold">{new Date(event.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="p-8 rounded-2xl border border-violet-500/30 bg-violet-500/5 text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Upload Event Photos</h2>
          <p className="text-white/50 max-w-md mx-auto mb-6">
            Upload event photos (JPG, PNG, HEIC, RAW — up to 1000 photos, 50MB each). Faces will be detected automatically.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.rw2,.orf,.pef,.srw,.rwl,.dcr,.kdc,.x3f,.mrw,.3fr,.iiq,.heic,.heif"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold transition-all disabled:opacity-50"
          >
            {uploading ? uploadProgress : 'Select Photos to Upload'}
          </button>
        </div>

        {/* Upload Results */}
        {uploadResults && (
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <h3 className="text-lg font-semibold mb-4">Upload Results</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uploadResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-sm p-3 rounded-xl ${
                    r.success ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <span>{r.success ? '✅' : '❌'}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.file}</p>
                    <p className={`text-xs mt-0.5 ${r.success ? 'text-green-400' : 'text-red-400'}`}>
                      {r.success ? `${r.facesIndexed} face(s) indexed` : r.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
