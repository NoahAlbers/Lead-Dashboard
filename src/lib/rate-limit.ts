// In-memory rate limiter — resets on server restart (acceptable for this use case)

const requestLog = new Map<string, number[]>();

// Clean up entries older than 1 hour every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - ONE_HOUR;
  for (const [ip, timestamps] of requestLog) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, filtered);
    }
  }
}

export function checkRateLimit(
  ip: string,
  opts?: { maxPerMinute?: number; maxPerHour?: number }
): { allowed: boolean; retryAfter?: number } {
  const maxPerMinute = opts?.maxPerMinute ?? 10;
  const maxPerHour = opts?.maxPerHour ?? 100;
  const now = Date.now();

  cleanup();

  const timestamps = requestLog.get(ip) ?? [];

  // Count requests in the last minute
  const minuteAgo = now - ONE_MINUTE;
  const recentMinute = timestamps.filter((t) => t > minuteAgo);
  if (recentMinute.length >= maxPerMinute) {
    const oldestInWindow = recentMinute[0];
    const retryAfter = Math.ceil((oldestInWindow + ONE_MINUTE - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  // Count requests in the last hour
  const hourAgo = now - ONE_HOUR;
  const recentHour = timestamps.filter((t) => t > hourAgo);
  if (recentHour.length >= maxPerHour) {
    const oldestInWindow = recentHour[0];
    const retryAfter = Math.ceil((oldestInWindow + ONE_HOUR - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  // Allowed — record this request
  timestamps.push(now);
  // Keep only timestamps from last hour
  const filtered = timestamps.filter((t) => t > hourAgo);
  requestLog.set(ip, filtered);

  return { allowed: true };
}
