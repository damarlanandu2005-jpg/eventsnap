import { supabaseAdmin } from '@/lib/supabase';
import { r2Download } from '@/lib/r2';
import sharp from 'sharp';
import { indexFaces, providerName } from '@/lib/face';
import { prepareForRekognition } from '@/lib/face/image';

export const config = { api: { bodyParser: true } };

const BATCH_SIZE = Number(process.env.QUEUE_BATCH_SIZE || 40);
const PROCESS_CONCURRENCY = Number(process.env.QUEUE_PROCESS_CONCURRENCY || 12);
const MAX_RUN_MS = Number(process.env.QUEUE_MAX_RUN_MS || 50000);
const STALE_PROCESSING_MINUTES = Number(process.env.QUEUE_STALE_PROCESSING_MINUTES || 10);

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// POST /api/cron/process-queue
// Drains queued photos through the active face-recognition provider
// (AWS Rekognition by default, InsightFace+pgvector when FACE_PROVIDER=insightface).
export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CRON_SECRET must be set; reject if missing to prevent accidental open access.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not set — refusing to process queue.');
    return res.status(500).json({ error: 'CRON_SECRET is not configured on this server.' });
  }

  const authSecret = (req.headers.authorization || '').replace('Bearer ', '');
  const provided = req.headers['x-cron-secret'] || req.body?.secret || authSecret;
  if (provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Provider readiness is checked lazily inside processOne — if the AWS
  // credentials or InsightFace URL are missing, the queue items will fail
  // with a clear error message instead of blocking the whole drain.

  const runId = await openRun(req).catch(() => null);
  const stats = { processed: 0, succeeded: 0, failed: 0, batches: 0 };

  try {
    const startedAt = Date.now();
    const eventId = req.body?.eventId || req.query?.eventId || null;

    await releaseStaleProcessingItems(eventId);

    while (Date.now() - startedAt < MAX_RUN_MS) {
      const { items, error: claimError } = await claimBatch(eventId);

      if (claimError) {
        await closeRun(runId, stats).catch(() => {});
        return res.status(500).json({ error: claimError.message });
      }

      if (!items.length) {
        await closeRun(runId, stats).catch(() => {});
        return res.status(200).json({
          message: stats.processed ? 'Queue drained.' : 'Queue empty - nothing to process.',
          ...stats,
          batchSize: BATCH_SIZE,
          concurrency: PROCESS_CONCURRENCY,
        });
      }

      const results = await mapWithConcurrency(
        items,
        PROCESS_CONCURRENCY,
        (item) => processOne(item)
      );

      stats.processed += items.length;
      stats.succeeded += results.filter((r) => r?.success).length;
      stats.failed += results.filter((r) => !r?.success).length;
      stats.batches += 1;

      if (items.length < BATCH_SIZE) {
        await closeRun(runId, stats).catch(() => {});
        return res.status(200).json({
          message: 'Queue drained.',
          ...stats,
          batchSize: BATCH_SIZE,
          concurrency: PROCESS_CONCURRENCY,
        });
      }
    }

    triggerContinuation(req, eventId, cronSecret);
    await closeRun(runId, stats).catch(() => {});

    return res.status(202).json({
      message: 'Processed time budget; continuing in background trigger.',
      ...stats,
      batchSize: BATCH_SIZE,
      concurrency: PROCESS_CONCURRENCY,
    });
  } catch (err) {
    console.error('process-queue error:', err);
    await closeRun(runId, stats).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}

// ── Run heartbeat ────────────────────────────────────────────────
// Lets confirm-upload skip kicking a fresh /api/cron/process-queue if
// one started in the last 10s. Cheap insert; non-fatal on failure.
async function openRun(req) {
  const source = req.body?.source || req.query?.source || 'self_chain';
  const eventId = req.body?.eventId || req.query?.eventId || null;
  const { data, error } = await supabaseAdmin
    .from('process_queue_runs')
    .insert({ source, event_id: eventId })
    .select('id')
    .single();
  if (error) {
    console.warn('[process-queue] openRun failed:', error.message);
    return null;
  }
  return data.id;
}

async function closeRun(runId, stats) {
  if (!runId) return;
  await supabaseAdmin
    .from('process_queue_runs')
    .update({
      finished_at: new Date().toISOString(),
      processed: stats.processed,
      succeeded: stats.succeeded,
      failed: stats.failed,
    })
    .eq('id', runId);
}

// Uses the Supabase RPC for atomic claiming so concurrent triggers don't double-process.
// Falls back to select-then-update if the RPC isn't available yet.
async function claimBatch(eventId) {
  // Try atomic RPC first (defined in migration 002)
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('claim_queue_batch', {
    p_batch_size: BATCH_SIZE,
    p_event_id: eventId || null,
  });

  if (!rpcError && rpcData) {
    return { items: rpcData, error: null };
  }

  // Fallback: optimistic select-then-update (slight race risk, acceptable for low volume)
  let query = supabaseAdmin
    .from('photo_processing_queue')
    .select('id, event_id, storage_path, original_filename, photo_id, attempts, upload_source')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (eventId) query = query.eq('event_id', eventId);

  const { data: items, error } = await query;
  if (error || !items?.length) return { items: items || [], error };

  // Only process items where update succeeds (prevents double-processing)
  const claimed = [];
  await Promise.all(
    items.map(async (item) => {
      const { data, error: updateErr } = await supabaseAdmin
        .from('photo_processing_queue')
        .update({
          status: 'processing',
          attempts: (item.attempts || 0) + 1,
          error_message: null,
        })
        .eq('id', item.id)
        .in('status', ['pending', 'failed'])
        .select('id');

      if (!updateErr && data?.length > 0) {
        claimed.push(item);
      }
    })
  );

  return { items: claimed, error: null };
}

async function releaseStaleProcessingItems(eventId) {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000).toISOString();
  let query = supabaseAdmin
    .from('photo_processing_queue')
    .update({ status: 'pending', error_message: 'Recovered stale processing item' })
    .eq('status', 'processing')
    .lt('created_at', staleBefore);

  if (eventId) query = query.eq('event_id', eventId);

  const { error } = await query;
  if (error) console.warn('Failed to release stale queue items:', error.message);
}

function triggerContinuation(req, eventId, cronSecret) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
  fetch(`${appUrl}/api/cron/process-queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': cronSecret,
    },
    body: JSON.stringify({ secret: cronSecret, eventId }),
  }).catch(() => {});
}

async function processOne(item) {
  const { id, event_id, storage_path, photo_id, upload_source } = item;

  // Verify storage path belongs to this event before processing
  if (!storage_path.startsWith(`events/${event_id}/`)) {
    const msg = `Storage path mismatch: ${storage_path} does not belong to event ${event_id}`;
    console.error(`[processOne] ${msg}`);
    await supabaseAdmin
      .from('photo_processing_queue')
      .update({ status: 'failed', error_message: msg })
      .eq('id', id);
    return { success: false, error: msg };
  }

  // Verify photo_id exists in event_photos for this event
  const { data: photoRow } = await supabaseAdmin
    .from('event_photos')
    .select('id')
    .eq('id', photo_id)
    .eq('event_id', event_id)
    .single();

  if (!photoRow) {
    const msg = `photo_id ${photo_id} not found in event_photos for event ${event_id}`;
    console.error(`[processOne] ${msg}`);
    await supabaseAdmin
      .from('photo_processing_queue')
      .update({ status: 'failed', error_message: msg })
      .eq('id', id);
    return { success: false, error: msg };
  }

  try {
    // Download photo — R2 for admin uploads, Supabase storage for photographer uploads
    let imageBuffer;
    if (upload_source === 'r2') {
      imageBuffer = await r2Download(storage_path);
    } else {
      const { data: blob, error: dlError } = await supabaseAdmin.storage
        .from('event-photos')
        .download(storage_path);
      if (dlError || !blob) throw new Error('Download failed: ' + (dlError?.message || 'no data'));
      imageBuffer = Buffer.from(await blob.arrayBuffer());
    }

    // Look up photographer_id once so cost-tracking + thumbnail share it.
    const { data: ep } = await supabaseAdmin
      .from('event_photos')
      .select('photographer_id')
      .eq('id', photo_id)
      .single();
    const photographer_id = ep?.photographer_id || null;

    // ── Single sharp decode per photo ─────────────────────────────
    // The previous version decoded the buffer twice (once inside
    // prepareForRekognition, once again for the thumbnail). For RAW
    // inputs that's two libraw passes per photo. Decoding once and
    // forking the pipeline shaves ~15–25% wall clock per photo at
    // bulk volume.
    let preparedBuffer = null;
    let thumbBuffer = null;
    try {
      const [prepared, thumb] = await Promise.all([
        prepareForRekognition(imageBuffer),
        sharp(imageBuffer, { failOn: 'none' })
          .rotate()
          .resize(250, null, { withoutEnlargement: true, fit: 'inside' })
          .jpeg({ quality: 70, mozjpeg: true })
          .toBuffer()
          .catch((e) => {
            console.warn(`[thumb] generation failed for ${photo_id}: ${e.message}`);
            return null;
          }),
      ]);
      preparedBuffer = prepared;
      thumbBuffer = thumb;
    } catch (decodeErr) {
      throw new Error('Image decode failed: ' + decodeErr.message);
    }

    // Now kick face-indexing + thumbnail upload concurrently.
    const indexPromise = indexFaces({
      eventId: event_id,
      photoId: photo_id,
      photographerId: photographer_id,
      imageBuffer,
      preparedBuffer,
    });

    const thumbPromise = (async () => {
      if (!thumbBuffer) return null;
      const thumbnailPath = `events/${event_id}/thumbs/${photo_id}.jpg`;
      const { error: thumbUploadErr } = await supabaseAdmin.storage
        .from('event-photos')
        .upload(thumbnailPath, thumbBuffer, { contentType: 'image/jpeg', upsert: true });

      if (thumbUploadErr) {
        console.warn(`[thumb] upload failed for ${photo_id}: ${thumbUploadErr.message}`);
        return null;
      }
      return thumbnailPath;
    })();

    const indexResult = await indexPromise;
    const faceCount = indexResult.faceCount || 0;
    const faceIds = indexResult.faceIds || [];

    const thumbnailPath = await thumbPromise;

    const photoUpdate = {
      processing_status: faceCount > 0 ? 'processed' : 'no_face',
      face_count: faceCount,
      processed_at: new Date().toISOString(),
    };
    if (thumbnailPath) photoUpdate.thumbnail_path = thumbnailPath;
    // Only the AWS provider populates Rekognition face IDs; InsightFace
    // returns an empty array and we leave the column at its default '{}'.
    if (faceIds.length && providerName === 'aws') {
      photoUpdate.rekognition_face_ids = faceIds;
    }

    await supabaseAdmin
      .from('event_photos')
      .update(photoUpdate)
      .eq('id', photo_id);

    await supabaseAdmin
      .from('photo_processing_queue')
      .update({ status: 'done', processed_at: new Date().toISOString(), error_message: null })
      .eq('id', id);

    return { success: true, photoId: photo_id, facesFound: faceCount };
  } catch (err) {
    console.error(`processOne failed for queue item ${id}:`, err.message);

    // Mark photo as failed so the UI shows the correct status
    await supabaseAdmin
      .from('event_photos')
      .update({ processing_status: 'failed' })
      .eq('id', photo_id);

    await supabaseAdmin
      .from('photo_processing_queue')
      .update({ status: 'failed', error_message: err.message, processed_at: null })
      .eq('id', id);

    return { success: false, error: err.message };
  }
}
