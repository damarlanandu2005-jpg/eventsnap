import { supabaseAdmin } from './supabase';

/**
 * Upload a file to Supabase Storage.
 * @param {string} bucket - Bucket name
 * @param {string} path - File path within bucket
 * @param {Buffer} buffer - File data
 * @param {string} contentType - MIME type
 */
export async function uploadToStorage(bucket, path, buffer, contentType) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return data;
}

/**
 * Download a file from Supabase Storage as a Buffer.
 * @param {string} bucket
 * @param {string} path
 * @returns {Promise<Buffer>}
 */
export async function downloadFromStorage(bucket, path) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .download(path);

  if (error) throw new Error(`Storage download failed: ${error.message}`);

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate a signed URL for private file access.
 * @param {string} bucket
 * @param {string} path
 * @param {number} [expiresIn=3600] - Seconds until expiry
 * @returns {Promise<string>} Signed URL
 */
export async function createSignedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(`Signed URL creation failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * Generate signed URLs for multiple files.
 * @param {string} bucket
 * @param {string[]} paths
 * @param {number} [expiresIn=3600]
 * @returns {Promise<Array<{path: string, signedUrl: string}>>}
 */
export async function createSignedUrls(bucket, paths, expiresIn = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);

  if (error) throw new Error(`Signed URLs creation failed: ${error.message}`);
  return data;
}

/**
 * Delete a file from Supabase Storage.
 * @param {string} bucket
 * @param {string} path
 */
export async function deleteFromStorage(bucket, path) {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([path]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
