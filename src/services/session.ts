const KEY = 'tripsense.sessionId';

function createId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `s_${random.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`;
}

let cached: string | null = null;

/** Anonymous per-tab session id used for analytics correlation only. */
export function getSessionId(): string {
  if (cached) return cached;
  try {
    cached = sessionStorage.getItem(KEY);
    if (!cached) {
      cached = createId();
      sessionStorage.setItem(KEY, cached);
    }
  } catch {
    cached = createId();
  }
  return cached;
}
