import type { ZodType, ZodTypeDef } from 'zod';
import { AgentError, TravelAgent } from '../agent/agent';
import type { IntentExtractor } from '../agent/intent';
import { MockTravelProvider, type TravelProvider } from '../providers/travelProvider';
import {
  analyticsEventSchema,
  conversationRequestSchema,
  searchRequestSchema,
  tripIdSchema,
  tripQuestionSchema,
  preferencesSchema,
} from './schemas';

/**
 * Backend-for-Frontend controller.
 *
 * Framework-agnostic: it takes a method, path and parsed JSON body and returns
 * a status and JSON body. The Node server, the Vite dev server and the
 * in-browser fallback all use this same code, so behaviour is identical.
 *
 *   Controller → validation → TravelAgent (orchestration) → tools → provider → data
 */

export interface ApiRequest {
  method: string;
  path: string;
  query?: URLSearchParams;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiError {
  error: { code: string; message: string; details?: string[] };
}

/** User-facing messages. Stack traces and internal errors are never returned. */
export const ERROR_MESSAGES = {
  invalid: 'I couldn\'t understand that request. Try something like "Find me a warm beach holiday under £500."',
  intent: 'Something went wrong while understanding your request. Please try again.',
  search: 'Travel search is temporarily unavailable. Please try again.',
  notFound: 'We couldn’t find that trip.',
  route: 'Not found.',
  internal: 'Something went wrong. Please try again.',
} as const;

export interface ControllerOptions {
  provider?: TravelProvider;
  intentExtractor?: IntentExtractor;
  now?: () => Date;
  /** Called with validated analytics events (the server logs them). */
  onEvents?: (events: unknown[]) => void;
  /** Called with unexpected errors so they can be logged server-side. */
  onError?: (error: unknown, context: string) => void;
  mode?: 'demo' | 'llm';
}

const fail = (status: number, code: string, message: string, details?: string[]): ApiResponse => ({
  status,
  body: { error: { code, message, ...(details ? { details } : {}) } } satisfies ApiError,
});

function validate<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): { ok: true; value: T } | { ok: false; response: ApiResponse } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const details = result.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
  return { ok: false, response: fail(400, 'invalid_request', ERROR_MESSAGES.invalid, details) };
}

function parsePreferencesQuery(query?: URLSearchParams): unknown {
  const raw = query?.get('preferences');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createController(options: ControllerOptions = {}) {
  const agent = new TravelAgent({
    provider: options.provider ?? new MockTravelProvider(),
    intentExtractor: options.intentExtractor,
    now: options.now,
  });
  const mode = options.mode ?? (options.intentExtractor ? 'llm' : 'demo');

  async function route(req: ApiRequest): Promise<ApiResponse> {
    const { method, path } = req;

    if (method === 'GET' && path === '/api/health') {
      return { status: 200, body: { status: 'ok', mode, provider: 'demo-data' } };
    }

    if (method === 'POST' && path === '/api/conversation') {
      const parsed = validate(conversationRequestSchema, req.body);
      if (!parsed.ok) return parsed.response;
      return { status: 200, body: await agent.converse(parsed.value) };
    }

    if (method === 'POST' && path === '/api/search') {
      const parsed = validate(searchRequestSchema, req.body);
      if (!parsed.ok) return parsed.response;
      return { status: 200, body: await agent.search(parsed.value.preferences) };
    }

    const tripMatch = path.match(/^\/api\/trips\/([^/]+)(\/questions)?$/);
    if (tripMatch) {
      const id = validate(tripIdSchema, tripMatch[1]);
      if (!id.ok) return fail(404, 'not_found', ERROR_MESSAGES.notFound);

      if (method === 'GET' && !tripMatch[2]) {
        const prefs = validate(preferencesSchema, parsePreferencesQuery(req.query));
        if (!prefs.ok) return prefs.response;
        const details = await agent.getTripDetails(id.value, prefs.value);
        return details ? { status: 200, body: details } : fail(404, 'not_found', ERROR_MESSAGES.notFound);
      }
      if (method === 'POST' && tripMatch[2]) {
        const parsed = validate(tripQuestionSchema, req.body);
        if (!parsed.ok) return parsed.response;
        const answer = await agent.askAboutTrip(id.value, parsed.value.question, parsed.value.preferences);
        return answer ? { status: 200, body: answer } : fail(404, 'not_found', ERROR_MESSAGES.notFound);
      }
    }

    if (method === 'GET' && path === '/api/recommendations') {
      const id = validate(tripIdSchema, req.query?.get('tripId') ?? '');
      if (!id.ok) return id.response;
      const prefs = validate(preferencesSchema, parsePreferencesQuery(req.query));
      if (!prefs.ok) return prefs.response;
      return { status: 200, body: { recommendations: await agent.recommendations(id.value, prefs.value) } };
    }

    if (method === 'POST' && path === '/api/events') {
      const parsed = validate(analyticsEventSchema, req.body);
      if (!parsed.ok) return parsed.response;
      options.onEvents?.(parsed.value.events);
      return { status: 202, body: { accepted: parsed.value.events.length } };
    }

    return fail(404, 'not_found', ERROR_MESSAGES.route);
  }

  return {
    async handle(req: ApiRequest): Promise<ApiResponse> {
      try {
        return await route(req);
      } catch (error) {
        if (error instanceof AgentError) {
          options.onError?.(error, `${req.method} ${req.path}`);
          return error.kind === 'intent'
            ? fail(502, 'ai_unavailable', ERROR_MESSAGES.intent)
            : fail(503, 'search_unavailable', ERROR_MESSAGES.search);
        }
        options.onError?.(error, `${req.method} ${req.path}`);
        return fail(500, 'internal_error', ERROR_MESSAGES.internal);
      }
    },
  };
}

export type Controller = ReturnType<typeof createController>;
