import type { PreferenceKey, RankedTrip, TravelPreferences, TripOption, Destination } from './travel';

export type ToolName =
  | 'extractIntent'
  | 'searchDestinations'
  | 'searchFlights'
  | 'searchHotels'
  | 'searchPackages'
  | 'getDestinationDetails'
  | 'compareTravelOptions'
  | 'filterResults'
  | 'rankResults'
  | 'suggestAlternatives';

export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

/**
 * A high-level, user-facing record of something the agent did.
 * This is NOT hidden reasoning — just the action, the tool and a short outcome.
 */
export interface AgentStep {
  id: string;
  label: string;
  tool: ToolName;
  status: StepStatus;
  /** Short outcome, e.g. "6 destinations warm in November". */
  detail?: string;
  durationMs: number;
}

export type IntentSource = 'rules' | 'llm';

export interface ComparisonSummary {
  bestValueId: string;
  topRatedId: string;
  closestBeachId: string | null;
  priceRange: { min: number; max: number };
}

/** A suggestion that broadens or changes the search, shown as a button. */
export interface SearchSuggestion {
  id: string;
  label: string;
  /** Preferences to apply if the user accepts the suggestion. */
  preferences: TravelPreferences;
  /** Number of trips the suggestion would return. */
  resultCount: number;
}

export type ConversationOutcome = 'results' | 'clarification' | 'no_results' | 'invalid' | 'reset';

export interface ChangeNote {
  key: PreferenceKey;
  label: string;
}

export interface AgentResponse {
  outcome: ConversationOutcome;
  reply: string;
  /** The full, merged preference state after this message. */
  preferences: TravelPreferences;
  /** What changed compared with the previous state (used for "I've updated…"). */
  changes: ChangeNote[];
  results: RankedTrip[];
  totalMatches: number;
  steps: AgentStep[];
  comparison: ComparisonSummary | null;
  suggestions: SearchSuggestion[];
  quickReplies: string[];
  intentSource: IntentSource;
  telemetry: { latencyMs: number; toolCalls: number; toolErrors: number };
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ConversationRequest {
  message: string;
  sessionId: string;
  /** Current preference state held by the client (the BFF is stateless). */
  preferences: TravelPreferences;
  /** Recent turns, for context. */
  history: ConversationTurn[];
  /** Ids of the trips currently shown, so "make it cheaper" can be relative. */
  visibleTripIds: string[];
}

export interface SearchRequest {
  preferences: TravelPreferences;
  sessionId: string;
}

export interface TripDetailsResponse {
  trip: TripOption;
  destination: Destination;
  ranked: RankedTrip | null;
  similar: RankedTrip[];
}

export interface TripQuestionResponse {
  answer: string;
  /** Data fields used to answer, shown as small "based on" chips. */
  basedOn: string[];
}
