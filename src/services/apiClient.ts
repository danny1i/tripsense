import type { AgentResponse, ConversationRequest, TripDetailsResponse, TripQuestionResponse } from '../types/agent';
import type { RankedTrip, TravelPreferences } from '../types/travel';
import type { ApiRequest, ApiResponse, Controller } from '../bff/controller';

/**
 * Frontend client for the BFF.
 *
 * The UI only ever talks to these functions. Normally they call the BFF over
 * HTTP (`/api/*`). If the page is opened from a static host with no BFF
 * running, the client falls back to running the same BFF controller in the
 * browser so the demo still works. (In that mode the optional AI model is
 * never used — API keys only exist on the server.)
 */

export type Transport = 'bff' | 'in-browser';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

let transport: Transport | null = null;
let localController: Promise<Controller> | null = null;
const listeners = new Set<(t: Transport) => void>();

function setTransport(next: Transport) {
  if (transport === next) return;
  transport = next;
  listeners.forEach((l) => l(next));
}

export function onTransportChange(listener: (t: Transport) => void): () => void {
  listeners.add(listener);
  if (transport) listener(transport);
  return () => listeners.delete(listener);
}

export function getTransport(): Transport | null {
  return transport;
}

async function getLocalController(): Promise<Controller> {
  localController ??= import('../bff/controller').then(({ createController }) => createController({ mode: 'demo' }));
  return localController;
}

async function callLocal(req: ApiRequest): Promise<ApiResponse> {
  const controller = await getLocalController();
  // Round-trip through JSON so the in-browser path behaves like the network.
  const res = await controller.handle({ ...req, body: req.body === undefined ? undefined : JSON.parse(JSON.stringify(req.body)) });
  return { status: res.status, body: JSON.parse(JSON.stringify(res.body)) };
}

async function callHttp(req: ApiRequest): Promise<ApiResponse | null> {
  const qs = req.query?.toString();
  let response: Response;
  try {
    response = await fetch(`${req.path}${qs ? `?${qs}` : ''}`, {
      method: req.method,
      headers: req.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    });
  } catch {
    return null; // network failure → no BFF reachable
  }
  // Only trust responses from the TripSense BFF. Any other host (a static
  // site, a hosting platform's own JSON 404) means "no BFF here".
  if (response.headers.get('x-tripsense-bff') !== '1') return null;
  return { status: response.status, body: await response.json() };
}

async function request<T>(req: ApiRequest): Promise<T> {
  let res: ApiResponse | null = null;
  if (transport !== 'in-browser') {
    res = await callHttp(req);
    if (res) setTransport('bff');
  }
  if (!res) {
    setTransport('in-browser');
    res = await callLocal(req);
  }
  if (res.status >= 400) {
    const body = res.body as { error?: { message?: string; code?: string } };
    throw new ApiClientError(body.error?.message ?? 'Something went wrong. Please try again.', body.error?.code ?? 'unknown', res.status);
  }
  return res.body as T;
}

export interface HealthResponse {
  status: string;
  mode: 'demo' | 'llm';
}

export const api = {
  health: () => request<HealthResponse>({ method: 'GET', path: '/api/health' }),

  converse: (body: ConversationRequest) => request<AgentResponse>({ method: 'POST', path: '/api/conversation', body }),

  search: (preferences: TravelPreferences, sessionId: string) =>
    request<AgentResponse>({ method: 'POST', path: '/api/search', body: { preferences, sessionId } }),

  trip: (id: string, preferences: TravelPreferences) =>
    request<TripDetailsResponse>({
      method: 'GET',
      path: `/api/trips/${encodeURIComponent(id)}`,
      query: new URLSearchParams({ preferences: JSON.stringify(preferences) }),
    }),

  recommendations: (tripId: string, preferences: TravelPreferences) =>
    request<{ recommendations: RankedTrip[] }>({
      method: 'GET',
      path: '/api/recommendations',
      query: new URLSearchParams({ tripId, preferences: JSON.stringify(preferences) }),
    }),

  askAboutTrip: (id: string, question: string, preferences: TravelPreferences) =>
    request<TripQuestionResponse>({ method: 'POST', path: `/api/trips/${encodeURIComponent(id)}/questions`, body: { question, preferences } }),

  sendEvents: (events: unknown[]) => request<{ accepted: number }>({ method: 'POST', path: '/api/events', body: { events } }),
};
