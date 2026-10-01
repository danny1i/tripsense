import { api, getTransport } from './apiClient';
import { getSessionId } from './session';

/**
 * Lightweight analytics abstraction.
 *
 * Events are kept in memory (shown on the Engineering page) and sent to the
 * BFF in small batches, where they are written as structured logs. In
 * production the BFF would forward them to an event pipeline (e.g. Kinesis
 * → S3/warehouse) for funnels and A/B test analysis.
 */

export type AnalyticsEventName =
  | 'search_started'
  | 'search_completed'
  | 'conversation_message_sent'
  | 'agent_tool_called'
  | 'result_viewed'
  | 'filter_applied'
  | 'trip_selected'
  | 'recommendation_clicked'
  | 'trip_question_asked'
  | 'error_shown';

export type EventProperties = Record<string, string | number | boolean | null>;

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  sessionId: string;
  timestamp: number;
  properties: EventProperties;
}

const MAX_BUFFER = 200;
const FLUSH_DELAY_MS = 2500;

const history: AnalyticsEvent[] = [];
let queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<() => void>();

async function flush(): Promise<void> {
  timer = null;
  if (queue.length === 0) return;
  const batch = queue.slice(0, 50);
  queue = queue.slice(50);
  // Only ship to a real BFF; the in-browser fallback has nowhere to send them.
  if (getTransport() === 'bff') {
    try {
      await api.sendEvents(batch);
    } catch {
      // Analytics must never break the product.
    }
  }
  if (queue.length > 0) schedule();
}

function schedule() {
  if (timer === null) timer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

export function track(name: AnalyticsEventName, properties: EventProperties = {}): void {
  const event: AnalyticsEvent = { name, sessionId: getSessionId(), timestamp: Date.now(), properties };
  history.push(event);
  if (history.length > MAX_BUFFER) history.shift();
  queue.push(event);
  schedule();
  subscribers.forEach((fn) => fn());
  if (import.meta.env.DEV) console.debug('[analytics]', name, properties);
}

export function getEventHistory(): readonly AnalyticsEvent[] {
  return history;
}

export function subscribeToEvents(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Simple derived metrics shown on the Engineering page. */
export function getMetrics() {
  const completed = history.filter((e) => e.name === 'search_completed');
  const latencies = completed.map((e) => Number(e.properties.latencyMs ?? 0)).filter((n) => n > 0);
  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  return {
    searches: completed.length,
    averageLatencyMs: avg,
    toolCalls: completed.reduce((sum, e) => sum + Number(e.properties.toolCalls ?? 0), 0),
    errors: history.filter((e) => e.name === 'error_shown').length,
    tripsViewed: history.filter((e) => e.name === 'trip_selected').length,
  };
}
