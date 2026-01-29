type Bucket = { count: number; resetAt: number };

declare global {
  // evita perder estado no hot reload do Next em dev
  var __rateLimitStore: Map<string, Bucket> | undefined;
}

const store = global.__rateLimitStore ?? new Map<string, Bucket>();
global.__rateLimitStore = store;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  store.set(key, bucket);

  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}
