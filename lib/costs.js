/**
 * Realtime infra-cost recorder.
 *
 * Each paid API call (Rekognition, Twilio, Resend, …) goes through `record`
 * here. We persist a row in `cost_events` with the cost in paise so the
 * admin dashboard can render today / 7d / 30d totals without polling the
 * AWS Billing API.
 *
 * Pricing constants live in INFRA_PRICING. They mirror the public AWS /
 * Twilio / Resend list prices as of 2026-01 and are tuned to Mumbai
 * (ap-south-1) where applicable. Adjust here when contract pricing or
 * regional rates change — every caller is one line so no other code edits.
 */

import { supabaseAdmin } from "./supabase.js";

// Approx USD → INR. Override via env when the rupee swings hard.
const USD_TO_INR = Number(process.env.USD_TO_INR || 96);

const usdToPaise = (usd) => Math.round(usd * USD_TO_INR * 100);

export const INFRA_PRICING = {
  aws_rekognition: {
    // ap-south-1 list prices (USD per 1,000 calls / 1,000 stored faces / month)
    index_faces_per_1k:   1.0,   // $1 / 1k images processed (per face metadata stored is separate, see store)
    search_faces_per_1k:  1.0,   // $1 / 1k SearchFacesByImage calls
    collection_storage_per_face_month: 0.00001, // $0.00001/face/month — negligible per call
  },
  storage: {
    // Per-MB delta; supabase egress is metered separately on their plans.
    r2_per_gb_month:        0.015, // $0.015 / GB / month
    supabase_per_gb_month:  0.021, // $0.021 / GB / month, ballpark
  },
  twilio: {
    sms_otp_india: 0.0083,   // $0.0083 per India SMS, ballpark
  },
  resend: {
    email_per_message: 0.0001, // $0.10 per 1k, ballpark
  },
};

/**
 * Record a cost event. Never throws — cost tracking must not break the
 * primary code path. Returns the inserted row id or null.
 */
export async function record({
  provider,
  operation,
  units = 1,
  costPaise,
  eventId = null,
  photographerId = null,
  meta = null,
}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("cost_events")
      .insert({
        provider,
        operation,
        units,
        cost_paise: costPaise ?? 0,
        event_id: eventId,
        photographer_id: photographerId,
        meta,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[costs] insert failed:", error.message);
      return null;
    }
    return data.id;
  } catch (err) {
    console.warn("[costs] insert threw:", err?.message);
    return null;
  }
}

// ── Convenience wrappers ─────────────────────────────────────────────────

export async function recordRekognitionIndex({ eventId, photographerId, faceCount }) {
  // Bill ≈ one IndexFaces call per image regardless of face count.
  const cost = usdToPaise(INFRA_PRICING.aws_rekognition.index_faces_per_1k / 1000);
  return record({
    provider: "aws_rekognition",
    operation: "index_faces",
    units: 1,
    costPaise: cost,
    eventId,
    photographerId,
    meta: { faces_indexed: faceCount },
  });
}

export async function recordRekognitionSearch({ eventId, photographerId, matchCount }) {
  const cost = usdToPaise(INFRA_PRICING.aws_rekognition.search_faces_per_1k / 1000);
  return record({
    provider: "aws_rekognition",
    operation: "search_faces",
    units: 1,
    costPaise: cost,
    eventId,
    photographerId,
    meta: { match_count: matchCount },
  });
}

export async function recordStorageUpload({ provider, eventId, photographerId, bytes }) {
  // Storage is monthly-recurring; we record the *delta* for visibility and
  // let the admin dashboard amortize. Cost shown is ½-month rent — a fair
  // proxy for "what does this upload eventually cost to keep alive".
  const gb = bytes / (1024 ** 3);
  const usdPerMonth =
    provider === "storage_r2"
      ? gb * INFRA_PRICING.storage.r2_per_gb_month
      : gb * INFRA_PRICING.storage.supabase_per_gb_month;
  return record({
    provider,
    operation: "storage_put",
    units: bytes,
    costPaise: usdToPaise(usdPerMonth * 0.5),
    eventId,
    photographerId,
    meta: { bytes },
  });
}
