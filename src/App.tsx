import { useCallback, useEffect, useRef, useState } from 'react';
import { useHashRoute } from './hooks/useHashRoute';
import { useTripSearch } from './hooks/useTripSearch';
import { api, onTransportChange, type Transport } from './services/apiClient';
import { track } from './services/analytics';
import { Footer, Header } from './components/Layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { SearchPage } from './pages/SearchPage';
import { EngineeringPage } from './pages/EngineeringPage';
import { TripDetails } from './components/TripDetails/TripDetails';

/**
 * App shell. Feature modules (Search, Conversation, Results, Trip Details,
 * Recommendations) are composed here; each could later become an
 * independently deployed micro-frontend.
 */
export function App() {
  const { route, navigate } = useHashRoute();
  const search = useTripSearch();
  const [transport, setTransport] = useState<Transport | null>(null);
  const [aiMode, setAiMode] = useState<'demo' | 'llm' | null>(null);

  useEffect(() => onTransportChange(setTransport), []);
  useEffect(() => {
    api
      .health()
      .then((h) => setAiMode(h.mode))
      .catch(() => setAiMode('demo'));
  }, []);

  // Move focus to the main region on page changes for screen-reader users
  // (but not on first load, so the search box keeps its autofocus).
  const isFirstRoute = useRef(true);
  useEffect(() => {
    if (isFirstRoute.current) isFirstRoute.current = false;
    else if (route.name !== 'trip') document.getElementById('main')?.focus({ preventScroll: true });
    if (route.name !== 'search') window.scrollTo({ top: 0 });
    const titles = { home: 'TripSense — Conversational Travel Search', search: 'Results — TripSense', trip: 'Trip details — TripSense', engineering: 'Engineering — TripSense' };
    document.title = titles[route.name];
  }, [route]);

  const startSearch = useCallback(
    (text: string) => {
      navigate({ name: 'search' });
      void search.sendMessage(text);
    },
    [navigate, search],
  );

  const viewTrip = useCallback(
    (tripId: string, source: 'results' | 'recommendation' = 'results') => {
      track('trip_selected', { tripId, source });
      if (source === 'recommendation') track('recommendation_clicked', { kind: 'similar_trip', tripId });
      navigate({ name: 'trip', tripId });
    },
    [navigate],
  );

  const hasSearch = search.state.messages.length > 0;

  return (
    <>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <Header route={route} onNavigate={navigate} hasSearch={hasSearch} transport={transport} aiMode={aiMode} />
      <main id="main" tabIndex={-1}>
        {route.name === 'home' && <LandingPage onSearch={startSearch} onOpenEngineering={() => navigate({ name: 'engineering' })} />}
        {route.name === 'search' && <SearchPage search={search} onViewTrip={(id) => viewTrip(id)} />}
        {route.name === 'trip' && (
          <TripDetails
            tripId={route.tripId}
            preferences={search.state.preferences}
            backLabel={hasSearch ? 'Back to results' : 'Back to search'}
            onBack={() => navigate({ name: hasSearch ? 'search' : 'home' })}
            onViewTrip={viewTrip}
          />
        )}
        {route.name === 'engineering' && <EngineeringPage />}
      </main>
      <Footer />
    </>
  );
}
