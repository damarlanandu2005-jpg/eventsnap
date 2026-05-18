/**
 * Cloudflare R2 Storage Client
 * R2 is S3-compatible — we use @aws-sdk/client-s3.
 *
 * Required env vars (add to Vercel / .env.local):
 *   R2_ACCOUNT_ID         = c5b2b89a9328e30828ee8daab30a07a4
 *   R2_ACCESS_KEY_ID      = your R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY  = your R2 API token Secret Access Key
 *   R2_BUCKET_NAME        = your bucket name (e.g. eventsnap-photos)
 *   R2_PUBLIC_URL         = (optional) public URL for the bucket
 *                           e.g. https://pub-xxxx.r2.dev  OR  https://cdn.eventsnap.in
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Singleton R2 client ──────────────────────────────────────────────────────
let _r2Client = null;

function getR2Client() {
  if (_r2Client) return _r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 credentials. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY to your environment variables."
    );
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _r2Client;
}

// ── Upload a Buffer to R2 ────────────────────────────────────────────────────
/**
 * @param {Buffer} body        - File content
 * @param {string} key         - Storage path, e.g. "selfies/uuid.jpg"
 * @param {string} contentType - MIME type, e.g. "image/jpeg"
 * @returns {Promise<{ key: string, url: string|null }>}
 */
export async function r2Upload(body, key, contentType) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not set.");

  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );

  const publicBase = process.env.R2_PUBLIC_URL;
  const url = publicBase ? `${publicBase.replace(/\/$/, "")}/${key}` : null;
  return { key, url };
}

// ── Download a file from R2 as a Buffer ─────────────────────────────────────
/**
 * @param {string} key
 * @returns {Promise<Buffer>}
 */
export async function r2Download(key) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not set.");

  const { Body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  // Body is a ReadableStream — collect to Buffer
  const chunks = [];
  for await (const chunk of Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Delete a file from R2 ────────────────────────────────────────────────────
/**
 * @param {string} key
 */
export async function r2Delete(key) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) return;

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.warn("R2 delete failed for", key, ":", err.message);
  }
}

// ── Generate a pre-signed GET URL (time-limited) ─────────────────────────────
/**
 * @param {string} key
 * @param {number} expiresIn - Seconds until expiry (default 24h)
 * @returns {Promise<string>}
 */
export async function r2GetSignedUrl(key, expiresIn = 86400) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not set.");

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

// ── Build a public URL for a key (if R2_PUBLIC_URL is configured) ────────────
/**
 * @param {string} key
 * @returns {string|null}
 */
export function r2PublicUrl(key) {
  const publicBase = process.env.R2_PUBLIC_URL;
  if (!publicBase) return null;
  return `${publicBase.replace(/\/$/, "")}/${key}`;
}
