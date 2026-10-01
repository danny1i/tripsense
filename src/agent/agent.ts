import type {
  AgentResponse,
  AgentStep,
  ChangeNote,
  ComparisonSummary,
  ConversationRequest,
  IntentSource,
  SearchSuggestion,
  ToolName,
  TripDetailsResponse,
  TripQuestionResponse,
} from '../types/agent';
import type { Destination, Month, PreferenceKey, RankedTrip, TravelPreferences, TripOption } from '../types/travel';
import { MONTHS } from '../types/travel';
import type { TravelProvider } from '../providers/travelProvider';
import { compact, describePreference, mergeIntent, PREFERENCE_ORDER } from './context';
import { ruleBasedExtractor, type IntentExtractor, type ParsedIntent } from './intent';
import { checkConstraints, rankTrips } from './ranking';
import { createTravelTools, type TravelTools } from './tools';
import { answerTripQuestion } from './tripQA';

/** Errors the BFF turns into friendly, non-technical messages. */
export class AgentError extends Error {
  constructor(
    readonly kind: 'intent' | 'search',
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export interface AgentOptions {
  provider: TravelProvider;
  /** Optional AI extractor. Falls back to rules if it fails or is absent. */
  intentExtractor?: IntentExtractor;
  /** Used to choose the travel month when the user doesn't give one. */
  now?: () => Date;
  origin?: string;
  /** Max results returned to the client. */
  resultLimit?: number;
}

/** Records user-facing steps and tool telemetry for one agent run. */
class StepRecorder {
  readonly steps: AgentStep[] = [];
  toolCalls = 0;
  toolErrors = 0;

  async run<T>(
    tool: ToolName,
    label: string,
    fn: () => Promise<T>,
    options: { critical: boolean; detail?: (result: T) => string | undefined },
  ): Promise<T | undefined> {
    const started = performance.now();
    this.toolCalls += 1;
    try {
      const result = await fn();
      this.steps.push({
        id: `${tool}-${this.steps.length}`,
        tool,
        label,
        status: 'done',
        detail: options.detail?.(result),
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (error) {
      this.toolErrors += 1;
      this.steps.push({
        id: `${tool}-${this.steps.length}`,
        tool,
        label,
        status: 'error',
        detail: 'This step failed',
        durationMs: Math.round(performance.now() - started),
      });
      if (options.critical) throw new AgentError('search', 'A required travel search tool failed', error);
      return undefined;
    }
  }

  note(tool: ToolName, label: string, detail?: string): void {
    this.steps.push({ id: `${tool}-${this.steps.length}`, tool, label, status: 'done', detail, durationMs: 0 });
  }
}

interface SearchOutcome {
  ranked: RankedTrip[];
  comparison: ComparisonSummary | null;
  suggestions: SearchSuggestion[];
  month: Month;
}

const ceil50 = (value: number) => Math.ceil(value / 50) * 50;
const ACTIONABLE_KEYS: PreferenceKey[] = PREFERENCE_ORDER.filter((k) => k !== 'travellers');

export function hasActionablePreferences(preferences: TravelPreferences): boolean {
  return ACTIONABLE_KEYS.some((key) => preferences[key] !== undefined);
}

function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export class TravelAgent {
  private readonly tools: TravelTools;
  private readonly provider: TravelProvider;
  private readonly intentExtractor?: IntentExtractor;
  private readonly now: () => Date;
  private readonly origin: string;
  private readonly resultLimit: number;

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.tools = createTravelTools(options.provider);
    this.intentExtractor = options.intentExtractor;
    this.now = options.now ?? (() => new Date());
    this.origin = options.origin ?? 'London Gatwick';
    this.resultLimit = options.resultLimit ?? 12;
  }

  /** Month used for weather when the user hasn't chosen one. */
  defaultMonth(): Month {
    return MONTHS[this.now().getMonth()] ?? 'January';
  }

  // ---------------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------------

  async converse(request: ConversationRequest): Promise<AgentResponse> {
    const started = performance.now();
    const rec = new StepRecorder();
    const current = compact(request.preferences);

    const { intent, source } = await this.extractIntent(request.message, current, rec);

    const finish = (partial: Omit<AgentResponse, 'telemetry' | 'intentSource'>): AgentResponse => ({
      ...partial,
      intentSource: source,
      telemetry: { latencyMs: Math.round(performance.now() - started), toolCalls: rec.toolCalls, toolErrors: rec.toolErrors },
    });

    const empty = { results: [], totalMatches: 0, comparison: null, suggestions: [], changes: [] as ChangeNote[] };

    if (intent.mode === 'reset') {
      return finish({
        ...empty,
        outcome: 'reset',
        reply: "Okay, I've cleared your search. Where would you like to go?",
        preferences: {},
        steps: rec.steps,
        quickReplies: ['Somewhere warm in November', 'A 4-day European city break', 'Family-friendly beach holiday'],
      });
    }

    if (!intent.travelRelated) {
      return finish({
        ...empty,
        outcome: 'invalid',
        reply: 'I couldn\'t understand that request. Try something like "Find me a warm beach holiday under £500."',
        preferences: current,
        steps: rec.steps,
        quickReplies: ['Find me a warm beach holiday under £500', 'I want a 4-day European city break'],
      });
    }

    // Questions about the trips already on screen ("which is cheapest?")
    if (intent.question && hasActionablePreferences(current)) {
      const outcome = await this.runSearch(current, intent.focus, rec);
      return finish({
        outcome: outcome.ranked.length ? 'results' : 'no_results',
        reply: this.answerResultsQuestion(intent.question, outcome),
        preferences: current,
        changes: [],
        results: outcome.ranked.slice(0, this.resultLimit),
        totalMatches: outcome.ranked.length,
        steps: rec.steps,
        comparison: outcome.comparison,
        suggestions: outcome.suggestions,
        quickReplies: [],
      });
    }

    const visibleTrips = await this.loadVisibleTrips(request.visibleTripIds);
    const { preferences, changes } = mergeIntent(current, intent, visibleTrips);

    if (!hasActionablePreferences(preferences)) {
      return finish({
        ...empty,
        outcome: 'clarification',
        reply: "I'd be happy to help. Do you have a preferred travel month or budget?",
        preferences,
        changes,
        steps: rec.steps,
        quickReplies: ['Somewhere warm in November', 'Under £500', 'A 4-day city break', 'Beach holiday for a family'],
      });
    }

    const outcome = await this.runSearch(preferences, intent.focus, rec);
    const isRefinement = intent.mode === 'refine' && hasActionablePreferences(current);

    return finish({
      outcome: outcome.ranked.length ? 'results' : 'no_results',
      reply: this.composeReply({ outcome, preferences, changes, intent, isRefinement }),
      preferences,
      changes: isRefinement ? changes : [],
      results: outcome.ranked.slice(0, this.resultLimit),
      totalMatches: outcome.ranked.length,
      steps: rec.steps,
      comparison: outcome.comparison,
      suggestions: outcome.suggestions,
      quickReplies: outcome.ranked.length ? this.followUps(preferences) : [],
    });
  }

  /** Structured search used by the filter panel (no free text involved). */
  async search(preferences: TravelPreferences): Promise<AgentResponse> {
    const started = performance.now();
    const rec = new StepRecorder();
    const prefs = compact(preferences);
    rec.note('extractIntent', 'Applied your filters', `${PREFERENCE_ORDER.filter((k) => prefs[k] !== undefined).length} active preferences`);
    const outcome = await this.runSearch(prefs, 'packages', rec);
    const count = outcome.ranked.length;
    return {
      outcome: count ? 'results' : 'no_results',
      reply: count ? `Showing ${count} ${count === 1 ? 'trip' : 'trips'} that match your filters.` : this.noResultsReply(prefs, outcome.suggestions),
      preferences: prefs,
      changes: [],
      results: outcome.ranked.slice(0, this.resultLimit),
      totalMatches: count,
      steps: rec.steps,
      comparison: outcome.comparison,
      suggestions: outcome.suggestions,
      quickReplies: [],
      intentSource: 'rules',
      telemetry: { latencyMs: Math.round(performance.now() - started), toolCalls: rec.toolCalls, toolErrors: rec.toolErrors },
    };
  }

  // ---------------------------------------------------------------------------
  // Trip details, recommendations and questions
  // ---------------------------------------------------------------------------

  async getTripDetails(tripId: string, preferences: TravelPreferences): Promise<TripDetailsResponse | null> {
    const trip = await this.provider.getTrip(tripId);
    if (!trip) return null;
    const destination = await this.provider.getDestination(trip.destinationId);
    if (!destination) return null;
    const month = preferences.month ?? this.defaultMonth();
    const ranked = rankTrips([{ trip, destination }], preferences, month)[0] ?? null;
    const similar = await this.recommendations(tripId, preferences);
    return { trip, destination, ranked, similar };
  }

  /** "Similar options": trips elsewhere that still fit the user's preferences. */
  async recommendations(tripId: string, preferences: TravelPreferences, limit = 3): Promise<RankedTrip[]> {
    const base = await this.provider.getTrip(tripId);
    if (!base) return [];
    const month = preferences.month ?? this.defaultMonth();
    const [trips, destinations] = await Promise.all([this.provider.listTrips(), this.provider.listDestinations()]);
    const byId = new Map(destinations.map((d) => [d.id, d]));
    const relaxed: TravelPreferences = { ...preferences, destinationIds: undefined };
    const candidates = trips
      .filter((t) => t.id !== tripId && t.destinationId !== base.destinationId)
      .map((trip) => ({ trip, destination: byId.get(trip.destinationId) }))
      .filter((c): c is { trip: TripOption; destination: Destination } => Boolean(c.destination))
      .filter((c) => checkConstraints(c.trip, c.destination, compact(relaxed), month).ok)
      .filter((c) => c.trip.holidayTypes.some((t) => base.holidayTypes.includes(t)));
    const ranked = rankTrips(candidates, compact(relaxed), month);
    const seen = new Set<string>();
    return ranked.filter((r) => (seen.has(r.destination.id) ? false : (seen.add(r.destination.id), true))).slice(0, limit);
  }

  async askAboutTrip(tripId: string, question: string, preferences: TravelPreferences): Promise<TripQuestionResponse | null> {
    const trip = await this.provider.getTrip(tripId);
    if (!trip) return null;
    const destination = await this.provider.getDestination(trip.destinationId);
    if (!destination) return null;
    return answerTripQuestion({ trip, destination, question, preferences, month: preferences.month ?? this.defaultMonth() });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async extractIntent(message: string, current: TravelPreferences, rec: StepRecorder): Promise<{ intent: ParsedIntent; source: IntentSource }> {
    const label = 'Understood your travel preferences';
    if (this.intentExtractor) {
      const started = performance.now();
      try {
        rec.toolCalls += 1;
        const intent = await this.intentExtractor.extract(message, current);
        rec.steps.push({ id: 'extractIntent-llm', tool: 'extractIntent', label, status: 'done', detail: 'Read by the AI model', durationMs: Math.round(performance.now() - started) });
        return { intent, source: this.intentExtractor.source };
      } catch {
        rec.toolErrors += 1;
        rec.steps.push({ id: 'extractIntent-llm', tool: 'extractIntent', label: 'AI model unavailable', status: 'error', detail: 'Switched to built-in rules', durationMs: Math.round(performance.now() - started) });
      }
    }
    try {
      const started = performance.now();
      rec.toolCalls += 1;
      const intent = await ruleBasedExtractor.extract(message, current);
      rec.steps.push({ id: 'extractIntent-rules', tool: 'extractIntent', label, status: 'done', detail: 'Rule-based (Demo Mode)', durationMs: Math.round(performance.now() - started) });
      return { intent, source: 'rules' };
    } catch (error) {
      throw new AgentError('intent', 'Intent extraction failed', error);
    }
  }

  private async loadVisibleTrips(ids: string[]): Promise<TripOption[]> {
    if (ids.length === 0) return [];
    const trips = await Promise.all(ids.slice(0, 50).map((id) => this.provider.getTrip(id).catch(() => undefined)));
    return trips.filter((t): t is TripOption => Boolean(t));
  }

  /** The orchestration plan: choose tools based on what the user asked for. */
  private async runSearch(prefs: TravelPreferences, focus: ParsedIntent['focus'], rec: StepRecorder): Promise<SearchOutcome> {
    const month = prefs.month ?? this.defaultMonth();
    let candidates: Destination[];

    if (prefs.destinationIds?.length) {
      // The user named a place: look it up directly instead of searching.
      const found = await rec.run(
        'getDestinationDetails',
        'Identified your destination',
        async () => (await Promise.all(prefs.destinationIds!.map((id) => this.tools.getDestinationDetails(id)))).filter((d): d is Destination => Boolean(d)),
        { critical: true, detail: (ds) => nameList(ds.map((d) => d.name)) },
      );
      candidates = found ?? [];
    } else {
      const found = await rec.run('searchDestinations', 'Identified suitable destinations', () => this.tools.searchDestinations({ preferences: prefs, month }), {
        critical: true,
        detail: (ds) => `${ds.length} ${ds.length === 1 ? 'destination' : 'destinations'}${prefs.temperature ? ` ${prefs.temperature} in ${month}` : ''}`,
      });
      candidates = found ?? [];
    }
    const candidateIds = candidates.map((d) => d.id);

    await rec.run('searchFlights', `Checked flights from ${this.origin}`, () => this.tools.searchFlights(this.origin, candidateIds, { month: prefs.month }, prefs.travellers ?? 2), {
      critical: false,
      detail: (flights) => {
        if (flights.length === 0) return 'No routes to check';
        const hours = flights.map((f) => f.durationHours);
        return `${Math.min(...hours)}–${Math.max(...hours)} hour flights`;
      },
    });

    const trips =
      focus === 'hotels'
        ? await rec.run('searchHotels', 'Searched hotels', () => this.tools.searchHotels(candidateIds, { month: prefs.month }, prefs.travellers ?? 2, prefs.budgetMax), {
            critical: true,
            detail: (ts) => `${ts.length} hotels found`,
          })
        : await rec.run('searchPackages', 'Searched travel packages', () => this.tools.searchPackages({ destinationIds: candidateIds, month: prefs.month }), {
            critical: true,
            detail: (ts) => `${ts.length} flight + hotel packages found`,
          });

    const byId = new Map(candidates.map((d) => [d.id, d]));
    const pool = (trips ?? []).map((trip) => ({ trip, destination: byId.get(trip.destinationId) })).filter(
      (c): c is { trip: TripOption; destination: Destination } => Boolean(c.destination),
    );
    const matching = pool.filter((c) => checkConstraints(c.trip, c.destination, prefs, month).ok);
    rec.note('filterResults', 'Filtered by your preferences', `${matching.length} of ${pool.length} match`);

    const ranked = rankTrips(matching, prefs, month);
    const top = ranked[0];
    rec.note('rankResults', 'Ranked matching trips', top ? `Top match: ${top.destination.name} (${top.score}/100)` : 'Nothing to rank');

    let comparison: ComparisonSummary | null = null;
    if (ranked.length > 1) {
      comparison =
        (await rec.run('compareTravelOptions', 'Compared prices and ratings', () => this.tools.compareTravelOptions(ranked.slice(0, 5).map((r) => r.trip.id)), {
          critical: false,
          detail: (c) => (c ? `£${c.priceRange.min}–£${c.priceRange.max} across the top picks` : undefined),
        })) ?? null;
    }

    let suggestions: SearchSuggestion[] = [];
    if (ranked.length === 0) {
      suggestions =
        (await rec.run('suggestAlternatives', 'Looked for close alternatives', () => this.findAlternatives(prefs, month), {
          critical: false,
          detail: (s) => (s.length ? `${s.length} ${s.length === 1 ? 'way' : 'ways'} to broaden your search` : 'No close alternatives'),
        })) ?? [];
    }

    return { ranked, comparison, suggestions, month };
  }

  /** For a no-result search, work out which single change would help most. */
  private async findAlternatives(prefs: TravelPreferences, month: Month): Promise<SearchSuggestion[]> {
    const [trips, destinations] = await Promise.all([this.provider.listTrips(), this.provider.listDestinations()]);
    const byId = new Map(destinations.map((d) => [d.id, d]));
    const all = trips.map((trip) => ({ trip, destination: byId.get(trip.destinationId)! })).filter((c) => c.destination);
    const countFor = (p: TravelPreferences) => all.filter((c) => checkConstraints(c.trip, c.destination, p, p.month ?? month).ok).length;

    const suggestions: SearchSuggestion[] = [];
    const add = (id: string, label: string, preferences: TravelPreferences) => {
      const resultCount = countFor(preferences);
      if (resultCount > 0) suggestions.push({ id, label, preferences: compact(preferences), resultCount });
    };

    if (prefs.budgetMax !== undefined) {
      const blockedOnlyByBudget = all.filter((c) => {
        const check = checkConstraints(c.trip, c.destination, prefs, month);
        return check.failed.length === 1 && check.failed[0] === 'budgetMax';
      });
      if (blockedOnlyByBudget.length > 0) {
        const cheapest = Math.min(...blockedOnlyByBudget.map((c) => c.trip.price));
        const newBudget = Math.max(ceil50(cheapest), prefs.budgetMax + 50);
        add('increase-budget', `Increase budget to £${newBudget}`, { ...prefs, budgetMax: newBudget });
      }
    }
    if (prefs.budgetLevel === 'low' && prefs.budgetMax === undefined) add('relax-cheap', 'Allow a higher budget', { ...prefs, budgetLevel: undefined });
    if (prefs.destinationIds?.length) add('widen-destination', 'Widen destination options', { ...prefs, destinationIds: undefined });
    if (prefs.beachMaxDistance !== undefined) {
      add('beach-distance', `Allow beach up to ${prefs.beachMaxDistance * 2 >= 1000 ? `${(prefs.beachMaxDistance * 2) / 1000} km` : `${prefs.beachMaxDistance * 2} m`}`, {
        ...prefs,
        beachMaxDistance: prefs.beachMaxDistance * 2,
      });
    } else if (prefs.beach) {
      add('no-beach', 'Don’t require a beach', { ...prefs, beach: undefined, holidayTypes: prefs.holidayTypes?.filter((t) => t !== 'beach') });
    }
    if (prefs.month) add('change-dates', 'Change dates (any month)', { ...prefs, month: undefined });
    if (prefs.durationDays) add('any-length', 'Any trip length', { ...prefs, durationDays: undefined });
    if (prefs.temperature) add('any-weather', 'Any temperature', { ...prefs, temperature: undefined });
    if (prefs.holidayTypes?.length) add('any-style', 'Any holiday style', { ...prefs, holidayTypes: prefs.beach ? ['beach'] : undefined });
    if (prefs.nightlife) add('any-nightlife', 'Nightlife not essential', { ...prefs, nightlife: undefined });
    if (prefs.minRating) add('lower-rating', 'Lower minimum rating', { ...prefs, minRating: undefined });
    if (prefs.familyFriendly) add('not-family', 'Not only family hotels', { ...prefs, familyFriendly: undefined });
    if (prefs.europeOnly) add('outside-europe', 'Include outside Europe', { ...prefs, europeOnly: undefined });

    return suggestions.sort((a, b) => b.resultCount - a.resultCount).slice(0, 4);
  }

  private noResultsReply(prefs: TravelPreferences, suggestions: SearchSuggestion[]): string {
    const budget = suggestions.find((s) => s.id === 'increase-budget');
    if (budget && prefs.budgetMax !== undefined && budget.preferences.budgetMax !== undefined) {
      return `I couldn't find an exact match. I found 0 options under £${prefs.budgetMax}, but there ${budget.resultCount === 1 ? 'is 1 option' : `are ${budget.resultCount} options`} between £${prefs.budgetMax}–£${budget.preferences.budgetMax}.`;
    }
    if (suggestions.length > 0) return "I couldn't find an exact match. Here are a few ways to broaden your search.";
    return 'No exact matches found. Try widening your budget or destination.';
  }

  private composeReply(args: {
    outcome: SearchOutcome;
    preferences: TravelPreferences;
    changes: ChangeNote[];
    intent: ParsedIntent;
    isRefinement: boolean;
  }): string {
    const { outcome, preferences, changes, intent, isRefinement } = args;
    const count = outcome.ranked.length;
    if (count === 0) return this.noResultsReply(preferences, outcome.suggestions);

    const top = outcome.ranked[0]!;
    const tripWord = count === 1 ? 'trip' : 'trips';
    const topLine = `${top.destination.name} is the strongest match at £${top.trip.price}pp.`;

    if (intent.set.destinationIds?.length && isRefinement) {
      const names = nameList(intent.set.destinationIds.map((id) => describePreference('destinationIds', { destinationIds: [id] }) ?? id));
      return `Here are ${names} options matching your current preferences. I found ${count} ${tripWord}.`;
    }
    if (isRefinement && changes.length > 0) {
      return `I've updated your search. I found ${count} ${tripWord} — ${topLine}`;
    }
    if (intent.focus === 'hotels') return `I found ${count} ${count === 1 ? 'hotel' : 'hotels'} matching your preferences. ${topLine}`;
    return `I found ${count} ${tripWord} matching your preferences. ${topLine}`;
  }

  private answerResultsQuestion(question: NonNullable<ParsedIntent['question']>, outcome: SearchOutcome): string {
    const { comparison, ranked } = outcome;
    if (!comparison || ranked.length === 0) return 'There are no trips on screen to compare yet.';
    const find = (id: string | null) => ranked.find((r) => r.trip.id === id);
    if (question === 'cheapest') {
      const r = find(comparison.bestValueId);
      return r ? `The best value of the top picks is ${r.trip.hotelName} in ${r.destination.name} at £${r.trip.price}pp.` : 'I could not work that out.';
    }
    if (question === 'top_rated') {
      const r = find(comparison.topRatedId);
      return r ? `The highest-rated hotel is ${r.trip.hotelName} in ${r.destination.name} (${r.trip.hotelRating}/5).` : 'I could not work that out.';
    }
    const r = find(comparison.closestBeachId);
    return r && r.trip.beachDistance !== null
      ? `${r.trip.hotelName} in ${r.destination.name} is closest to the beach — about ${r.trip.beachDistance} m away.`
      : 'None of the top picks are near a beach.';
  }

  private followUps(preferences: TravelPreferences): string[] {
    const replies: string[] = [];
    if (!preferences.budgetMax) replies.push('Make it cheaper');
    if (!preferences.beachMaxDistance) replies.push('Closer to the beach');
    if (!preferences.destinationIds) replies.push('What about Tenerife?');
    if (!preferences.familyFriendly) replies.push('Family-friendly only');
    replies.push('Which is the best rated?');
    return replies.slice(0, 4);
  }
}
