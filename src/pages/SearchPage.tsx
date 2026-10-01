import type { TripSearch } from '../hooks/useTripSearch';
import { ConversationPanel } from '../components/Chat/ConversationPanel';
import { ResultsView } from '../components/Results/ResultsView';
import { SearchBox, SuggestedPrompts } from '../components/Search/SearchBox';
import { track } from '../services/analytics';
import './pages.css';

interface Props {
  search: TripSearch;
  onViewTrip: (tripId: string) => void;
}

export function SearchPage({ search, onViewTrip }: Props) {
  const { state, sendMessage, applyPreferences, removePreference, reset } = search;
  const lastUserMessage = [...state.messages].reverse().find((m) => m.role === 'user');

  if (state.messages.length === 0 && state.phase === 'idle') {
    return (
      <div className="container search-empty">
        <h1>Where do you want to go?</h1>
        <SearchBox onSubmit={sendMessage} autoFocus />
        <SuggestedPrompts onPick={sendMessage} />
      </div>
    );
  }

  return (
    <div className="container search-layout">
      <h1 className="visually-hidden">Search results</h1>
      <aside className="search-layout__chat">
        <ConversationPanel
          messages={state.messages}
          phase={state.phase}
          steps={state.steps}
          revealedSteps={state.revealedSteps}
          onSend={sendMessage}
          onApplySuggestion={(prefs, suggestion) => {
            track('recommendation_clicked', { kind: 'broaden_search', id: suggestion.id });
            void applyPreferences(prefs, 'suggestion');
          }}
          onReset={reset}
        />
      </aside>
      <div className="search-layout__results">
        <ResultsView
          response={state.current}
          preferences={state.preferences}
          phase={state.phase}
          steps={state.steps}
          revealedSteps={state.revealedSteps}
          error={state.error}
          onViewTrip={onViewTrip}
          onRemovePreference={removePreference}
          onApplyFilters={(prefs) => void applyPreferences(prefs, 'filters')}
          onApplySuggestion={(prefs, suggestion) => {
            track('recommendation_clicked', { kind: 'broaden_search', id: suggestion.id });
            void applyPreferences(prefs, 'suggestion');
          }}
          onRetry={() => (lastUserMessage ? void sendMessage(lastUserMessage.text) : void applyPreferences(state.preferences, 'filters'))}
        />
      </div>
    </div>
  );
}
