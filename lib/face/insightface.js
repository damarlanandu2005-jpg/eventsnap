/**
 * InsightFace provider — talks to the Railway Python service that wraps
 * insightface buffalo_l/buffalo_sc and returns 512-dim embeddings.
 *
 * Matching is done in Postgres via the `match_faces` pgvector RPC.
 *
 * Required env vars:
 *   INSIGHTFACE_SERVICE_URL
 *   INSIGHTFACE_API_KEY   — optional, sent as x-api-key when set
 *   FACE_MATCH_THRESHOLD  — optional, default 0.50 (cosine, 0–1)
 */

import { supabaseAdmin } from "../supabase.js";
import { prepareForRekognition } from "./image.js";

const COSINE_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.5);

function serviceUrl() {
  const url = process.env.INSIGHTFACE_SERVICE_URL;
  if (!url) throw new Error("INSIGHTFACE_SERVICE_URL not configured");
  return url;
}

function headers() {
  const h = {};
  if (process.env.INSIGHTFACE_API_KEY) {
    h["x-api-key"] = process.env.INSIGHTFACE_API_KEY;
  }
  return h;
}

export async function ensureEventCollection(_eventId) {
  // InsightFace stores embeddings in pgvector keyed by event_id — no
  // per-event collection setup is needed. The face_embeddings table is
  // created via migrations 001/002.
  return null;
}

export async function indexFaces({ eventId, photoId, imageBuffer }) {
  // Funnel through the same JPEG-normaliser the AWS path uses so InsightFace
  // also gets a sane size and never has to decode RAW itself.
  const prepared = await prepareForRekognition(imageBuffer);

  const form = new FormData();
  form.append("image", new Blob([prepared], { type: "image/jpeg" }), "photo.jpg");

  const res = await fetch(`${serviceUrl()}/embed-batch`, {
    method: "POST",
    body: form,
    headers: headers(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`InsightFace embed-batch error: ${res.status} ${body}`);
  }

  const { embeddings, face_count } = await res.json();
  if (!face_count || !embeddings?.length) {
    return { faceIds: [], faceCount: 0, embedding: null, embeddings: [] };
  }

  // Replace any prior embeddings for this photo so retries don't double-insert.
  await supabaseAdmin
    .from("face_embeddings")
    .delete()
    .eq("photo_id", photoId)
    .eq("event_id", eventId);

  const { data: ep } = await supabaseAdmin
    .from("event_photos")
    .select("photographer_id")
    .eq("id", photoId)
    .single();

  const rows = embeddings.map((embedding) => ({
    event_id: eventId,
    photo_id: photoId,
    photographer_id: ep?.photographer_id || null,
    embedding: `[${embedding.join(",")}]`,
  }));

  const { error } = await supabaseAdmin.from("face_embeddings").insert(rows);
  if (error) throw new Error("pgvector insert failed: " + error.message);

  return { faceIds: [], faceCount: face_count, embedding: embeddings[0], embeddings };
}

export async function searchByImage({ eventId, imageBuffer }) {
  const prepared = await prepareForRekognition(imageBuffer);

  const form = new FormData();
  form.append("image", new Blob([prepared], { type: "image/jpeg" }), "selfie.jpg");

  const res = await fetch(`${serviceUrl()}/embed`, {
    method: "POST",
    body: form,
    headers: headers(),
  });

  if (!res.ok) {
    if (res.status === 422 || res.status === 400) {
      return { matches: [], embedding: null, noFaceDetected: true };
    }
    const body = await res.text().catch(() => "");
    throw new Error(`InsightFace embed error: ${res.status} ${body}`);
  }

  const { embedding } = await res.json();
  if (!embedding) return { matches: [], embedding: null, noFaceDetected: true };

  const { data, error } = await supabaseAdmin.rpc("match_faces", {
    query_embedding: JSON.stringify(embedding),
    event_id_filter: eventId,
    match_threshold: COSINE_THRESHOLD,
    match_count: 50,
  });
  if (error) throw new Error("match_faces RPC failed: " + error.message);

  const matches = (data || []).map((row) => ({
    photoId: row.photo_id,
    similarity: row.similarity,
  }));
  return { matches, embedding };
}

export async function deleteEventFaces(eventId) {
  const { error } = await supabaseAdmin
    .from("face_embeddings")
    .delete()
    .eq("event_id", eventId);
  if (error) throw error;
  return { collectionId: null };
}
