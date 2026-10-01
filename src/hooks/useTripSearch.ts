import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { AgentResponse, AgentStep, ConversationTurn } from '../types/agent';
import type { PreferenceKey, TravelPreferences } from '../types/travel';
import { api, ApiClientError } from '../services/apiClient';
import { track } from '../services/analytics';
import { getSessionId } from '../services/session';
import { removePreference as removePref, describePreference } from '../agent/context';
import { prefersReducedMotion } from './useReducedMotion';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  response?: AgentResponse;
  isError?: boolean;
}

export type SearchPhase = 'idle' | 'thinking' | 'revealing' | 'ready' | 'error';

export interface TripSearchState {
  messages: ChatMessage[];
  preferences: TravelPreferences;
  /** Latest response that produced results (kept on screen during refinement). */
  current: AgentResponse | null;
  /** Steps of the run currently being revealed / last run. */
  steps: AgentStep[];
  revealedSteps: number;
  phase: SearchPhase;
  error: string | null;
}

type Action =
  | { type: 'user_message'; message: ChatMessage }
  | { type: 'system_message'; message: ChatMessage }
  | { type: 'thinking' }
  | { type: 'received'; response: AgentResponse; message: ChatMessage; reveal: boolean }
  | { type: 'reveal_next' }
  | { type: 'failed'; error: string; message: ChatMessage }
  | { type: 'reset' };

const initialState: TripSearchState = {
  messages: [],
  preferences: {},
  current: null,
  steps: [],
  revealedSteps: 0,
  phase: 'idle',
  error: null,
};

let nextId = 0;
const id = () => `m${(nextId += 1)}`;

function reducer(state: TripSearchState, action: Action): TripSearchState {
  switch (action.type) {
    case 'user_message':
    case 'system_message':
      return { ...state, messages: [...state.messages, action.message] };
    case 'thinking':
      return { ...state, phase: 'thinking', error: null, steps: [], revealedSteps: 0 };
    case 'received': {
      const { response } = action;
      const showsResults = response.outcome === 'results' || response.outcome === 'no_results';
      return {
        ...state,
        messages: [...state.messages, action.message],
        preferences: response.preferences,
        current: showsResults ? response : response.outcome === 'reset' ? null : state.current,
        steps: response.steps,
        revealedSteps: action.reveal ? 0 : response.steps.length,
        phase: action.reveal && response.steps.length > 0 ? 'revealing' : 'ready',
      };
    }
    case 'reveal_next': {
      const revealed = state.revealedSteps + 1;
      return { ...state, revealedSteps: revealed, phase: revealed >= state.steps.length ? 'ready' : 'revealing' };
    }
    case 'failed':
      return { ...state, phase: 'error', error: action.error, messages: [...state.messages, action.message] };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

const STEP_REVEAL_MS = 260;
const MIN_THINKING_MS = 450;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function friendlyError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Travel search is temporarily unavailable. Please try again.';
}

/**
 * Conversation + search state for the whole app. Holds the active preference
 * state and keeps conversational input and the filter panel in sync.
 */
export function useTripSearch() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef(0);

  // Reveal agent steps one by one (skipped for reduced motion).
  useEffect(() => {
    if (state.phase !== 'revealing') return;
    const timer = setTimeout(() => dispatch({ type: 'reveal_next' }), STEP_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [state.phase, state.revealedSteps]);

  const handleResponse = useCallback((response: AgentResponse, source: 'conversation' | 'filters', started: number) => {
    const reveal = !prefersReducedMotion();
    const message: ChatMessage = source === 'filters'
      ? { id: id(), role: 'system', text: response.reply, response }
      : { id: id(), role: 'assistant', text: response.reply, response };
    dispatch({ type: 'received', response, message, reveal });
    track('search_completed', {
      source,
      outcome: response.outcome,
      results: response.totalMatches,
      latencyMs: Math.round(performance.now() - started),
      serverLatencyMs: response.telemetry.latencyMs,
      toolCalls: response.telemetry.toolCalls,
      toolErrors: response.telemetry.toolErrors,
      intentSource: response.intentSource,
    });
    for (const step of response.steps) {
      track('agent_tool_called', { tool: step.tool, status: step.status, durationMs: step.durationMs });
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message) return;
      const ticket = (inFlight.current += 1);
      const snapshot = stateRef.current;
      dispatch({ type: 'user_message', message: { id: id(), role: 'user', text: message } });
      dispatch({ type: 'thinking' });
      track('conversation_message_sent', { length: message.length, turn: snapshot.messages.filter((m) => m.role === 'user').length + 1 });
      track('search_started', { source: 'conversation' });
      const started = performance.now();

      const history: ConversationTurn[] = snapshot.messages
        .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));

      try {
        const [response] = await Promise.all([
          api.converse({
            message,
            sessionId: getSessionId(),
            preferences: snapshot.preferences,
            history,
            visibleTripIds: snapshot.current?.results.map((r) => r.trip.id) ?? [],
          }),
          prefersReducedMotion() ? Promise.resolve() : wait(MIN_THINKING_MS),
        ]);
        if (ticket !== inFlight.current) return; // a newer request superseded this one
        handleResponse(response, 'conversation', started);
      } catch (error) {
        if (ticket !== inFlight.current) return;
        const text = friendlyError(error);
        dispatch({ type: 'failed', error: text, message: { id: id(), role: 'assistant', text, isError: true } });
        track('error_shown', { where: 'conversation', code: error instanceof ApiClientError ? error.code : 'network' });
      }
    },
    [handleResponse],
  );

  const applyPreferences = useCallback(
    async (preferences: TravelPreferences, source: 'filters' | 'chip' | 'suggestion') => {
      const ticket = (inFlight.current += 1);
      dispatch({ type: 'thinking' });
      track('filter_applied', { source, keys: Object.keys(preferences).join(',') });
      track('search_started', { source });
      const started = performance.now();
      try {
        const response = await api.search(preferences, getSessionId());
        if (ticket !== inFlight.current) return;
        handleResponse(response, 'filters', started);
      } catch (error) {
        if (ticket !== inFlight.current) return;
        const text = friendlyError(error);
        dispatch({ type: 'failed', error: text, message: { id: id(), role: 'assistant', text, isError: true } });
        track('error_shown', { where: 'filters', code: error instanceof ApiClientError ? error.code : 'network' });
      }
    },
    [handleResponse],
  );

  const removePreference = useCallback(
    (key: PreferenceKey) => {
      const label = describePreference(key, stateRef.current.preferences);
      const next = removePref(stateRef.current.preferences, key);
      dispatch({ type: 'system_message', message: { id: id(), role: 'system', text: `Removed “${label ?? key}”.` } });
      void applyPreferences(next, 'chip');
    },
    [applyPreferences],
  );

  const reset = useCallback(() => {
    inFlight.current += 1;
    dispatch({ type: 'reset' });
  }, []);

  return { state, sendMessage, applyPreferences, removePreference, reset };
}

export type TripSearch = ReturnType<typeof useTripSearch>;
