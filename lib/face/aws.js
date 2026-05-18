/**
 * AWS Rekognition face provider.
 *
 * One Rekognition Collection per event (id = `event_${eventId}` with dashes
 * stripped to match Rekognition's [a-zA-Z0-9_.-]{1,255} naming rule).
 *
 * Required env vars:
 *   AWS_REGION                — e.g. "us-east-1"
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   FACE_MATCH_THRESHOLD      — optional, default 80 (0–100)
 *
 * Rekognition accepts JPEG/PNG only and max 5 MB per call when sending bytes
 * directly (15 MB for S3-backed calls). Callers must hand us a JPEG/PNG buffer
 * that's already been downscaled/converted if needed — see lib/face/image.js.
 */

import {
  RekognitionClient,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  ListFacesCommand,
} from "@aws-sdk/client-rekognition";

import { supabaseAdmin } from "../supabase.js";
import { prepareForRekognition } from "./image.js";
import { recordRekognitionIndex, recordRekognitionSearch } from "../costs.js";

const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 80);

let _client = null;
function client() {
  if (_client) return _client;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS Rekognition not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY."
    );
  }
  _client = new RekognitionClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 1, // we drive retries ourselves so we can also bump throttle counters
  });
  return _client;
}

// Rekognition occasionally throws ThrottlingException / ProvisionedThroughputExceededException
// under bulk indexing. Retry with jittered exponential backoff before failing the photo.
const RETRYABLE_NAMES = new Set([
  "ThrottlingException",
  "ProvisionedThroughputExceededException",
  "RequestTimeout",
  "RequestTimeoutException",
  "InternalServerError",
  "ServiceUnavailable",
]);

async function withRetry(label, fn) {
  const maxAttempts = Number(process.env.REKOG_MAX_ATTEMPTS || 4);
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (!RETRYABLE_NAMES.has(err?.name) || attempt >= maxAttempts) throw err;
      const base = 400 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 250);
      const wait = base + jitter;
      console.warn(`[rekognition] ${label} attempt ${attempt} hit ${err.name}; backing off ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export function collectionIdFor(eventId) {
  // Rekognition collection IDs must match [a-zA-Z0-9_.\-]{1,255}.
  // Event UUIDs already qualify after we strip dashes, but keep the
  // dashes-allowed pattern for readability.
  return `event_${String(eventId).replace(/[^a-zA-Z0-9_.\-]/g, "")}`;
}

/**
 * Ensure a Rekognition collection exists for this event and that the
 * events.rekognition_collection_id column reflects it. Safe to call repeatedly.
 */
export async function ensureEventCollection(eventId) {
  const collectionId = collectionIdFor(eventId);
  try {
    await client().send(new CreateCollectionCommand({ CollectionId: collectionId }));
  } catch (err) {
    // ResourceAlreadyExistsException is expected on re-runs.
    if (err?.name !== "ResourceAlreadyExistsException") {
      throw err;
    }
  }

  await supabaseAdmin
    .from("events")
    .update({ rekognition_collection_id: collectionId })
    .eq("id", eventId);

  return collectionId;
}

/**
 * Index all detectable faces in a photo into the event's collection.
 * Returns the Rekognition face IDs so the caller can persist them on event_photos.
 */
export async function indexFaces({ eventId, photoId, imageBuffer, photographerId = null, preparedBuffer = null }) {
  const collectionId = await ensureEventCollection(eventId);
  // Allow callers to pass a pre-prepared JPEG (process-queue does this so
  // sharp only decodes the image once per photo).
  const prepared = preparedBuffer || await prepareForRekognition(imageBuffer);

  const out = await withRetry("index_faces", () =>
    client().send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: prepared },
        // ExternalImageId lets us recover the photoId from a SearchFacesByImage hit.
        // Must match [a-zA-Z0-9_.\-:]+ so we strip dashes from the UUID.
        ExternalImageId: String(photoId).replace(/[^a-zA-Z0-9_.\-:]/g, ""),
        DetectionAttributes: [],
        QualityFilter: "AUTO",
        MaxFaces: 50,
      })
    )
  );

  const faceIds = (out.FaceRecords || []).map((r) => r.Face?.FaceId).filter(Boolean);

  // Fire-and-forget cost log. Never blocks the upload pipeline.
  recordRekognitionIndex({
    eventId,
    photographerId,
    faceCount: faceIds.length,
  }).catch(() => {});

  return { faceIds, faceCount: faceIds.length, embedding: null };
}

/**
 * Search a selfie against the event's collection. Returns a deduped list of
 * { photoId, similarity } where similarity is a 0–1 float.
 */
export async function searchByImage({ eventId, imageBuffer, photographerId = null }) {
  const collectionId = collectionIdFor(eventId);
  const prepared = await prepareForRekognition(imageBuffer);

  let resp;
  try {
    resp = await withRetry("search_faces", () =>
      client().send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: { Bytes: prepared },
          FaceMatchThreshold: FACE_MATCH_THRESHOLD,
          MaxFaces: 50,
          QualityFilter: "AUTO",
        })
      )
    );
  } catch (err) {
    if (err?.name === "InvalidParameterException") {
      // Rekognition throws this when no face is detected in the selfie.
      return { matches: [], embedding: null, noFaceDetected: true };
    }
    if (err?.name === "ResourceNotFoundException") {
      // Collection doesn't exist yet — no photos indexed.
      return { matches: [], embedding: null };
    }
    throw err;
  }

  const byPhoto = new Map();
  for (const m of resp.FaceMatches || []) {
    const photoId = restoreUuid(m.Face?.ExternalImageId);
    if (!photoId) continue;
    const sim = (m.Similarity || 0) / 100;
    const prev = byPhoto.get(photoId);
    if (!prev || sim > prev) byPhoto.set(photoId, sim);
  }

  const matches = [...byPhoto.entries()].map(([photoId, similarity]) => ({
    photoId,
    similarity,
  }));
  matches.sort((a, b) => b.similarity - a.similarity);

  // Cost log — one call regardless of how many faces matched.
  recordRekognitionSearch({
    eventId,
    photographerId,
    matchCount: matches.length,
  }).catch(() => {});

  return { matches, embedding: null };
}

/**
 * GDPR purge — delete the entire collection for an event. Photo rows + face IDs
 * stored on event_photos.rekognition_face_ids are reset by the caller (see
 * lib/cleanup.js).
 */
export async function deleteEventFaces(eventId) {
  const collectionId = collectionIdFor(eventId);
  try {
    await client().send(new DeleteCollectionCommand({ CollectionId: collectionId }));
  } catch (err) {
    if (err?.name !== "ResourceNotFoundException") throw err;
  }
  return { collectionId };
}

/**
 * Delete a specific photo's face IDs from the collection (used when a single
 * photo is deleted from an event).
 */
export async function deletePhotoFaces({ eventId, faceIds }) {
  if (!faceIds?.length) return { deleted: 0 };
  const collectionId = collectionIdFor(eventId);
  try {
    const out = await client().send(
      new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: faceIds })
    );
    return { deleted: (out.DeletedFaces || []).length };
  } catch (err) {
    if (err?.name === "ResourceNotFoundException") return { deleted: 0 };
    throw err;
  }
}

// UUIDs lose their dashes when written to ExternalImageId. Restore canonical
// form so callers can use the result directly against event_photos.id.
function restoreUuid(externalId) {
  if (!externalId) return null;
  const hex = externalId.replace(/[^a-f0-9]/gi, "");
  if (hex.length !== 32) return externalId; // not a uuid — return as-is
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
