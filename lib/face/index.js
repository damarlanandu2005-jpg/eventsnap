/**
 * Face recognition provider abstraction.
 *
 * Provider chosen by env var FACE_PROVIDER:
 *   "aws"         (default) — AWS Rekognition collections + IndexFaces/SearchFacesByImage
 *   "insightface"           — Railway Python service producing 512-dim embeddings,
 *                             matched via pgvector cosine similarity
 *
 * All providers expose the same shape so callers don't care which one is live:
 *
 *   await provider.ensureEventCollection(eventId)
 *   await provider.indexFaces({ eventId, photoId, imageBuffer })
 *     → { faceIds: string[], faceCount: number, embedding?: number[] }
 *
 *   await provider.searchByImage({ eventId, imageBuffer })
 *     → { matches: [{ photoId, similarity }], embedding?: number[] }
 *
 *   await provider.deleteEventFaces(eventId)
 *
 * NOTE: providers that don't need an embedding column (AWS) return embedding=null
 * and rely on per-photo face IDs stored in event_photos.rekognition_face_ids.
 */

import * as awsProvider from "./aws.js";
import * as insightProvider from "./insightface.js";

const PROVIDER = (process.env.FACE_PROVIDER || "aws").toLowerCase();

const ALL = {
  aws: awsProvider,
  insightface: insightProvider,
};

if (!ALL[PROVIDER]) {
  console.warn(
    `[face] Unknown FACE_PROVIDER="${PROVIDER}", falling back to "aws".`
  );
}

export const provider = ALL[PROVIDER] || ALL.aws;
export const providerName = ALL[PROVIDER] ? PROVIDER : "aws";

export async function ensureEventCollection(eventId) {
  return provider.ensureEventCollection(eventId);
}

export async function indexFaces(args) {
  return provider.indexFaces(args);
}

export async function searchByImage(args) {
  return provider.searchByImage(args);
}

export async function deleteEventFaces(eventId) {
  return provider.deleteEventFaces(eventId);
}
