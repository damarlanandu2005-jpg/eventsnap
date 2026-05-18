import archiver from 'archiver';
import { supabaseAdmin } from '@/lib/supabase';
import { r2Download } from '@/lib/r2';

const DOWNLOAD_CONCURRENCY = Number(process.env.ZIP_DOWNLOAD_CONCURRENCY || 8);

async function downloadPhotoBuffer(photo) {
  // Download directly from Cloudflare R2
  return r2Download(photo.storage_path);
}

async function appendPhotosWithConcurrency(archive, photos) {
  let nextIndex = 0;
  let appended = 0;

  async function worker() {
    while (nextIndex < photos.length) {
      const index = nextIndex++;
      const photo = photos[index];

      try {
        const buffer = await downloadPhotoBuffer(photo);
        const ext = photo.storage_path.split('.').pop()?.toLowerCase() || 'jpg';
        const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
        const filename = `event-photo-${String(index + 1).padStart(3, '0')}-${photo.id.slice(0, 8)}.${safeExt}`;
        archive.append(buffer, { name: filename });
        appended += 1;
      } catch (dlErr) {
        console.warn(`Failed to download ${photo.storage_path}:`, dlErr.message);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, photos.length) }, () => worker())
  );

  return appended;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // token = the download token UUID from /api/upload
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    // 1. Validate token and get the linked match_request
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('download_tokens')
      .select('*, match_requests(*)')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRow) {
      return res.status(404).json({ error: 'Invalid or expired download link.' });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This download link has expired.' });
    }

    const matchRequest = tokenRow.match_requests;

    if (!matchRequest?.matched_photo_ids?.length) {
      return res.status(404).json({ error: 'No matched photos found for this token.' });
    }

    // 2. Get photo records from DB
    const { data: photos } = await supabaseAdmin
      .from('event_photos')
      .select('storage_path, id')
      .in('id', matchRequest.matched_photo_ids);

    if (!photos || photos.length === 0) {
      return res.status(404).json({ error: 'Photos not found' });
    }

    // 3. Stream a zip back to the client
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="event-photos.zip"');

    // Photos are already compressed, so store mode is much faster than
    // trying to recompress every JPEG/PNG during ZIP creation.
    const archive = archiver('zip', { store: true });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) res.status(500).end();
    });

    archive.pipe(res);

    const appended = await appendPhotosWithConcurrency(archive, photos);
    if (appended === 0) {
      archive.append('No photos could be downloaded. Please try again later.', {
        name: 'download-error.txt',
      });
    }

    await archive.finalize();
  } catch (err) {
    console.error('Download all error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}
