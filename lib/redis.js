/**
 * Shared Redis / BullMQ connection for Vercel API routes.
 * Uses ioredis with Upstash Redis (REDIS_URL env var).
 *
 * In serverless environments each invocation gets its own connection
 * that must be closed after use. Use getRedis() + closeRedis() pattern.
 */

import Redis from "ioredis";

/**
 * Create a short-lived ioredis connection suitable for Vercel serverless.
 * Caller is responsible for calling .disconnect() or .quit() when done.
 */
export function createRedisConnection() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL environment variable is not set.");
  }
  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,   // Required by BullMQ
    enableOfflineQueue: false,
    connectTimeout: 5000,
    lazyConnect: false,
    tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
  });
}

/**
 * Safely disconnect a Redis connection.
 */
export async function closeRedis(redis) {
  try {
    await redis.quit();
  } catch (_) {
    redis.disconnect();
  }
}
