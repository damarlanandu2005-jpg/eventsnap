import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// Larger batches for high-volume sessions. Signing is cheap (no actual
// upload), so 1000+ in one call is fine. Concurrency bumped accordingly.
const MAX_BATCH_FILES = 1000;
const SIGNED_URL_CONCURRENCY = 50;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function normalizeFiles(body) {
  if (Array.isArray(body.files)) {
    return body.files.slice(0, MAX_BATCH_FILES).map((file) => ({
      filename: file.filename,
      contentType: file.contentType,
      fileSizeBytes: Number(file.fileSizeBytes || 0),
    }));
  }

  if (body.filename || body.fileSizeBytes) {
    return [{
      filename: body.filename,
      contentType: body.contentType,
      fileSizeBytes: Number(body.fileSizeBytes || 0),
    }];
  }

  return [];
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

function isMissingQuotaFunction(error) {
  return error?.code === 'PGRST202' || /check_and_reserve_upload_quota|rollback_upload_quota/i.test(error?.message || '');
}

async function rollbackQuotaIfReserved(reservedQuota, photographerId, fileSizeMb) {
  if (!reservedQuota) return;
  const { error } = await supabaseAdmin.rpc('rollback_upload_quota', {
    p_photographer_id: photographerId,
    p_file_size_mb: fileSizeMb,
  });
  if (error && !isMissingQuotaFunction(error)) {
    console.warn('Quota rollback failed:', error.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { eventId } = req.body;
  const files = normalizeFiles(req.body);

  if (!eventId || files.length === 0) {
    return res.status(400).json({ error: 'eventId and at least one file are required' });
  }

  if (Array.isArray(req.body.files) && req.body.files.length > MAX_BATCH_FILES) {
    return res.status(400).json({ error: `A maximum of ${MAX_BATCH_FILES} files is allowed per batch` });
  }

  const invalidFile = files.find((file) =>
    !file.filename ||
    !file.fileSizeBytes ||
    file.fileSizeBytes <= 0 ||
    file.fileSizeBytes > MAX_FILE_SIZE_BYTES
  );

  if (invalidFile) {
    return res.status(400).json({
      error: `Each file needs filename and fileSizeBytes, and must be <= ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
    });
  }

  const totalFileSizeMb = files.reduce((sum, file) => sum + file.fileSizeBytes, 0) / (1024 * 1024);
  let reservedQuota = false;

  const { data: quotaResult, error: quotaError } =
    await supabaseAdmin.rpc('check_and_reserve_upload_quota', {
      p_photographer_id: user.id,
      p_file_size_mb: totalFileSizeMb,
    });

  if (quotaError && !isMissingQuotaFunction(quotaError))
    return res.status(500).json({ error: 'Quota check failed' });

  if (!quotaError) reservedQuota = true;

  if (quotaResult && !quotaResult.allowed)
    return res.status(429).json({
      error: quotaResult.reason,
      upgradeRequired: true,
      used: quotaResult.used,
      limit: quotaResult.limit,
    });

  const { data: ev } = await supabaseAdmin
    .from('events').select('id')
    .eq('id', eventId).eq('photographer_id', user.id).single();

  if (!ev) {
    await rollbackQuotaIfReserved(reservedQuota, user.id, totalFileSizeMb);
    return res.status(403).json({ error: 'Event not found' });
  }

  try {
    const uploads = await mapWithConcurrency(files, SIGNED_URL_CONCURRENCY, async (file) => {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'jpg';
      const photoId = uuidv4();
      const storagePath = `events/${eventId}/${photoId}.${ext}`;

      const { data: signedData, error: signedError } =
        await supabaseAdmin.storage
          .from('event-photos')
          .createSignedUploadUrl(storagePath);

      if (signedError) throw signedError;

      return {
        signedUrl: signedData.signedUrl,
        storagePath,
        photoId,
        filename: file.filename,
        contentType: file.contentType,
        fileSizeBytes: file.fileSizeBytes,
      };
    });

    if (!Array.isArray(req.body.files)) {
      const first = uploads[0];
      return res.status(200).json({
        signedUrl: first.signedUrl,
        storagePath: first.storagePath,
        photoId: first.photoId,
      });
    }

    return res.status(200).json({ uploads });
  } catch (signedError) {
    await rollbackQuotaIfReserved(reservedQuota, user.id, totalFileSizeMb);
    return res.status(500).json({ error: 'Failed to create upload URL' });
  }
}
