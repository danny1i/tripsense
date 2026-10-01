import { useState } from 'react';
import type { AgentResponse, SearchSuggestion } from '../../types/agent';
import type { PreferenceKey, TravelPreferences } from '../../types/travel';
import type { SearchPhase } from '../../hooks/useTripSearch';
import { TravelCard } from '../TravelCard/TravelCard';
import { PreferenceChips } from '../Preferences/PreferenceChips';
import { FilterPanel } from '../Filters/FilterPanel';
import { AgentActivityPanel } from '../AgentActivity/AgentActivity';
import { DemoNotice } from '../Layout/Layout';
import { Icon } from '../Icon/Icon';
import { RANKING_WEIGHTS } from '../../agent/ranking';
import './Results.css';

interface Props {
  response: AgentResponse | null;
  preferences: TravelPreferences;
  phase: SearchPhase;
  steps: AgentResponse['steps'];
  revealedSteps: number;
  error: string | null;
  onViewTrip: (tripId: string) => void;
  onRemovePreference: (key: PreferenceKey) => void;
  onApplyFilters: (preferences: TravelPreferences) => void;
  onApplySuggestion: (preferences: TravelPreferences, suggestion: SearchSuggestion) => void;
  onRetry: () => void;
}

function highlightFor(response: AgentResponse, tripId: string): string | undefined {
  const c = response.comparison;
  if (!c) return undefined;
  if (c.bestValueId === tripId) return 'Best value';
  if (c.topRatedId === tripId) return 'Top rated';
  if (c.closestBeachId === tripId) return 'Closest to beach';
  return undefined;
}

function NoResults({ response, onApplySuggestion, busy }: { response: AgentResponse; onApplySuggestion: Props['onApplySuggestion']; busy: boolean }) {
  return (
    <div className="no-results card" role="status">
      <span className="no-results__icon" aria-hidden="true">
        <Icon name="search" size={28} />
      </span>
      <h3>I couldn’t find an exact match.</h3>
      <p className="muted">{response.reply.replace("I couldn't find an exact match. ", '')}</p>
      {response.suggestions.length > 0 ? (
        <>
          <p className="no-results__prompt">Try one of these:</p>
          <ul className="no-results__list">
            {response.suggestions.map((s) => (
              <li key={s.id}>
                <button type="button" className="btn btn-secondary" onClick={() => onApplySuggestion(s.preferences, s)} disabled={busy}>
                  {s.label}
                  <span className="no-results__count">
                    {s.resultCount} {s.resultCount === 1 ? 'trip' : 'trips'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>No exact matches found. Try widening your budget or destination.</p>
      )}
    </div>
  );
}

export function ResultsView(props: Props) {
  const { response, preferences, phase, steps, revealedSteps, error, onViewTrip, onRemovePreference, onApplyFilters, onApplySuggestion, onRetry } = props;
  const [showFilters, setShowFilters] = useState(false);
  const busy = phase === 'thinking' || phase === 'revealing';
  const ready = !busy;
  const count = response?.totalMatches ?? 0;

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results__intent">
        <p className="results__intent-label">I understand you’re looking for:</p>
        {Object.keys(preferences).length ? (
          <PreferenceChips preferences={preferences} onRemove={onRemovePreference} disabled={busy} />
        ) : (
          <p className="muted">No preferences yet — describe a trip or use the filters.</p>
        )}
      </div>

      <AgentActivityPanel
        steps={steps}
        revealed={revealedSteps}
        running={busy}
        intentSource={response?.intentSource}
        telemetry={ready ? response?.telemetry : undefined}
      />

      <div className="results__toolbar">
        <div aria-live="polite" aria-atomic="true">
          <h2 id="results-title" className="results__title">
            {busy ? 'Searching…' : response ? (count ? `I found ${count} ${count === 1 ? 'trip' : 'trips'} matching your preferences.` : 'No exact matches') : 'Your results'}
          </h2>
          {ready && response && count > 0 && response.results.length < count && (
            <p className="muted results__subtitle">Showing the top {response.results.length}.</p>
          )}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={showFilters} aria-controls="filter-panel" onClick={() => setShowFilters((s) => !s)}>
          <Icon name="filter" size={16} /> {showFilters ? 'Hide filters' : 'Filters'}
        </button>
      </div>

      {showFilters && (
        <div id="filter-panel">
          <FilterPanel preferences={preferences} onApply={onApplyFilters} disabled={busy} />
        </div>
      )}

      {phase === 'error' && error && (
        <div className="results__error card" role="alert">
          <Icon name="alert" size={20} />
          <p>{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      <div className={`results__body${busy ? ' is-busy' : ''}`} aria-busy={busy}>
        {response && response.outcome === 'no_results' && ready && <NoResults response={response} onApplySuggestion={onApplySuggestion} busy={busy} />}
        {response && response.results.length > 0 && (
          <ul className="results__grid">
            {response.results.map((ranked, index) => (
              <li key={ranked.trip.id}>
                <TravelCard ranked={ranked} rank={index + 1} onView={onViewTrip} highlight={highlightFor(response, ranked.trip.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="results__footer">
        <DemoNotice />
        <p className="results__weights">
          Ranking (demo model): budget {RANKING_WEIGHTS.budget * 100}% · preferences {RANKING_WEIGHTS.preference * 100}% · destination {RANKING_WEIGHTS.destination * 100}% · rating {RANKING_WEIGHTS.rating * 100}% · convenience {RANKING_WEIGHTS.convenience * 100}%
        </p>
      </footer>
    </section>
  );
}
