import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

const MAX_BATCH_FILES = 1000;

function normalizeUploads(body) {
  if (Array.isArray(body.uploads)) {
    return body.uploads.slice(0, MAX_BATCH_FILES).map((upload) => ({
      eventId: upload.eventId || body.eventId,
      storagePath: upload.storagePath,
      photoId: upload.photoId,
      originalFilename: upload.originalFilename,
      fileSizeBytes: upload.fileSizeBytes,
      uploadSource: upload.uploadSource || body.uploadSource,
    }));
  }

  return [{
    eventId: body.eventId,
    storagePath: body.storagePath,
    photoId: body.photoId,
    originalFilename: body.originalFilename,
    fileSizeBytes: body.fileSizeBytes,
    uploadSource: body.uploadSource,
  }];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { photographer } = auth;

  const uploads = normalizeUploads(req.body);

  if (Array.isArray(req.body.uploads) && req.body.uploads.length > MAX_BATCH_FILES) {
    return res.status(400).json({ error: `A maximum of ${MAX_BATCH_FILES} uploads is allowed per batch` });
  }

  if (uploads.some((upload) => !upload.eventId || !upload.storagePath || !upload.photoId)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Guard: storage path must be scoped to the declared event
  const mismatch = uploads.find(
    (upload) => !upload.storagePath.startsWith(`events/${upload.eventId}/`)
  );
  if (mismatch) {
    return res.status(400).json({ error: 'Storage path does not match the declared event' });
  }

  // Verify all eventIds belong to this photographer
  const eventIds = [...new Set(uploads.map((upload) => upload.eventId))];
  const { data: ownedEvents, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('photographer_id', photographer.id)
    .in('id', eventIds);

  if (eventError) return res.status(500).json({ error: eventError.message });

  const ownedEventIds = new Set((ownedEvents || []).map((e) => e.id));
  if (eventIds.some((eventId) => !ownedEventIds.has(eventId))) {
    return res.status(403).json({ error: 'Event not found or not owned by you' });
  }

  // Enforce photos_per_event limit
  const { data: subRow } = await supabaseAdmin
    .from('subscriptions')
    .select('photos_per_event')
    .eq('photographer_id', photographer.id)
    .single();

  const photosPerEvent = subRow?.photos_per_event ?? 100;

  for (const eventId of eventIds) {
    const uploadsForEvent = uploads.filter((u) => u.eventId === eventId).length;
    const { count: existing } = await supabaseAdmin
      .from('event_photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if ((existing || 0) + uploadsForEvent > photosPerEvent) {
      return res.status(403).json({
        error: `Photo limit of ${photosPerEvent} per event would be exceeded for event ${eventId}.`,
      });
    }
  }

  // Insert event_photos records with photographer_id
  const photoRows = uploads.map((upload) => ({
    id: upload.photoId,
    event_id: upload.eventId,
    storage_path: upload.storagePath,
    original_filename: upload.originalFilename || 'photo.jpg',
    photographer_id: photographer.id,
    processing_status: 'pending',
    file_size_bytes: upload.fileSizeBytes || 0,
  }));

  const { error: photoError } = await supabaseAdmin
    .from('event_photos')
    .insert(photoRows);

  if (photoError) return res.status(500).json({ error: photoError.message });

  const queueRows = uploads.map((upload) => ({
    event_id: upload.eventId,
    storage_path: upload.storagePath,
    original_filename: upload.originalFilename || 'photo.jpg',
    status: 'pending',
    photo_id: upload.photoId,
    upload_source: upload.uploadSource || 'supabase',
    file_size_bytes: upload.fileSizeBytes || 0,
  }));

  // Queue failure must not roll back a successful event_photos insert —
  // photos are already tracked in event_photos and visible in the gallery.
  // Worst case: face-indexing is delayed until the queue is healthy again.
  let queueRowsResult = null;
  try {
    const { data, error: queueError } = await supabaseAdmin
      .from('photo_processing_queue')
      .insert(queueRows)
      .select('id, photo_id');
    if (queueError) {
      console.warn('Queue insert returned error:', queueError.message);
    } else {
      queueRowsResult = data;
    }
  } catch (queueThrow) {
    console.warn('Queue insert threw:', queueThrow?.message || queueThrow);
  }

  // Increment photos_used (fire-and-forget; supabase-js v2 .rpc() is a
  // thenable, not a real Promise — wrap in async IIFE so .catch() works).
  for (let i = 0; i < uploads.length; i++) {
    (async () => {
      try { await supabaseAdmin.rpc('increment_photos_used', { p_photographer_id: photographer.id }); }
      catch (_) {}
    })();
  }

  // Trigger processing — coalesce so back-to-back batches don't each spin
  // a fresh cron invocation. We treat any run started or still-running in
  // the last 10s as "already kicked" and skip.
  if (process.env.CRON_SECRET) {
    const skipWindowMs = Number(process.env.PROCESS_QUEUE_COALESCE_MS || 10_000);
    const cutoff = new Date(Date.now() - skipWindowMs).toISOString();

    const { data: recentRuns } = await supabaseAdmin
      .from('process_queue_runs')
      .select('id, finished_at')
      .gte('started_at', cutoff)
      .limit(1);

    const hasRecentRun = (recentRuns || []).some((r) => !r.finished_at) ||
      (recentRuns || []).some((r) => r.finished_at && new Date(r.finished_at) > new Date(cutoff));

    if (!hasRecentRun) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
      fetch(`${appUrl}/api/cron/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET,
        },
        body: JSON.stringify({
          secret: process.env.CRON_SECRET,
          eventId: eventIds[0],
          source: 'confirm_upload',
        }),
      }).catch(() => {});
    }
  }

  if (!Array.isArray(req.body.uploads)) {
    return res.status(200).json({ success: true, photoId: uploads[0].photoId, queued: true });
  }

  return res.status(200).json({
    success: true,
    queued: queueRowsResult?.length || uploads.length,
    photoIds: uploads.map((upload) => upload.photoId),
  });
}
