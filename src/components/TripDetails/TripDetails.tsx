import { useEffect, useState } from 'react';
import type { TripDetailsResponse } from '../../types/agent';
import type { ScoreBreakdown, TravelPreferences } from '../../types/travel';
import { MONTHS } from '../../types/travel';
import { api, ApiClientError } from '../../services/apiClient';
import { track } from '../../services/analytics';
import { RANKING_WEIGHTS } from '../../agent/ranking';
import { DestinationArt } from '../DestinationArt/DestinationArt';
import { TravelCard, formatDistance, formatPrice } from '../TravelCard/TravelCard';
import { DemoNotice } from '../Layout/Layout';
import { Icon } from '../Icon/Icon';
import { AskAboutTrip } from './AskAboutTrip';
import './TripDetails.css';

interface Props {
  tripId: string;
  preferences: TravelPreferences;
  onBack: () => void;
  backLabel: string;
  onViewTrip: (tripId: string, source: 'recommendation') => void;
}

const BREAKDOWN_LABELS: Record<keyof ScoreBreakdown, string> = {
  budget: 'Budget match',
  preference: 'Preference match',
  destination: 'Destination match',
  rating: 'Hotel rating',
  convenience: 'Convenience',
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function TripDetails({ tripId, preferences, onBack, backLabel, onViewTrip }: Props) {
  const [data, setData] = useState<TripDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .trip(tripId, preferences)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        track('result_viewed', { tripId, destination: res.destination.id, score: res.ranked?.score ?? null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Travel search is temporarily unavailable. Please try again.');
        track('error_shown', { where: 'trip_details' });
      });
    return () => {
      cancelled = true;
    };
    // preferences intentionally read once per trip view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, attempt]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [tripId]);

  const back = (
    <button type="button" className="btn btn-ghost trip__back" onClick={onBack}>
      <Icon name="arrowLeft" size={18} /> {backLabel}
    </button>
  );

  if (error) {
    return (
      <div className="container trip">
        {back}
        <div className="results__error card" role="alert">
          <Icon name="alert" size={20} />
          <p>{error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container trip" aria-busy="true">
        {back}
        <div className="trip__skeleton card" role="status">
          <span className="spinner" aria-hidden="true" /> Loading trip details…
        </div>
      </div>
    );
  }

  const { trip, destination, ranked, similar } = data;
  const month = preferences.month;
  const temperature = ranked?.temperatureForMonth ?? Math.max(...Object.values(destination.temperatureByMonth));
  // Without a chosen month the server scores against the current month.
  const monthLabel = month ?? MONTHS[new Date().getMonth()];

  return (
    <article className="container trip" aria-labelledby="trip-title">
      {back}

      <div className="trip__hero card">
        <div className="trip__art">
          <DestinationArt destination={destination} size="hero" />
        </div>
        <div className="trip__hero-body">
          <p className="eyebrow">
            {destination.country} · {destination.region}
          </p>
          <h1 id="trip-title">{destination.name}</h1>
          <p className="trip__hotel">
            <Icon name="hotel" size={18} /> {trip.hotelName}
          </p>
          <p className="trip__summary">{trip.description}</p>
          <div className="trip__price-row">
            <p>
              <span className="trip__price">{formatPrice(trip.price)}</span> <span className="muted">per person</span>
            </p>
            {ranked && <span className="badge badge-neutral">{ranked.score}% match</span>}
          </div>
          <p className="muted trip__includes">
            Includes return flights from {trip.departureAirport} and {trip.boardBasis.toLowerCase()} accommodation.
          </p>
        </div>
      </div>

      <dl className="trip__facts">
        <div>
          <dt>
            <Icon name="calendar" size={18} /> Dates
          </dt>
          <dd>{month ? `Flexible dates in ${month}` : `Available ${trip.availableMonths.length === 12 ? 'all year' : `${trip.availableMonths[0]}–${trip.availableMonths.at(-1)}`}`}</dd>
        </div>
        <div>
          <dt>
            <Icon name="clock" size={18} /> Duration
          </dt>
          <dd>
            {trip.nights} nights · {trip.duration} days
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="star" size={18} /> Hotel rating
          </dt>
          <dd>{trip.hotelRating} / 5</dd>
        </div>
        <div>
          <dt>
            <Icon name="sun" size={18} /> Temperature
          </dt>
          <dd>
            {temperature}°C in {monthLabel}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="beach" size={18} /> Beach
          </dt>
          <dd>{trip.beachDistance === null ? 'No beach nearby' : `${formatDistance(trip.beachDistance)} away`}</dd>
        </div>
        <div>
          <dt>
            <Icon name="plane" size={18} /> Flight
          </dt>
          <dd>About {destination.flightHoursFromLondon} hours</dd>
        </div>
      </dl>

      <div className="trip__layout">
        <div className="trip__main">
          {ranked && (
            <section className="trip__section card" aria-labelledby="why-title">
              <h2 id="why-title">Why this matches</h2>
              <p className="trip__why">{ranked.explanation}</p>
              <ul className="travel-card__reasons">
                {ranked.matchReasons.map((r) => (
                  <li key={r}>
                    <Icon name="check" size={16} /> {r}
                  </li>
                ))}
              </ul>
              <div className="score-bars" aria-label="Score breakdown (demonstration model)">
                {(Object.keys(RANKING_WEIGHTS) as (keyof ScoreBreakdown)[]).map((key) => (
                  <div key={key} className="score-bar">
                    <span className="score-bar__label">
                      {BREAKDOWN_LABELS[key]} <span className="muted">({RANKING_WEIGHTS[key] * 100}%)</span>
                    </span>
                    <span className="score-bar__track" aria-hidden="true">
                      <span className="score-bar__fill" style={{ width: `${Math.round(ranked.breakdown[key] * 100)}%` }} />
                    </span>
                    <span className="score-bar__value">{Math.round(ranked.breakdown[key] * 100)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="trip__section card" aria-labelledby="amenities-title">
            <h2 id="amenities-title">Hotel & amenities</h2>
            <ul className="amenities">
              {trip.amenities.map((a) => (
                <li key={a}>
                  <Icon name="check" size={16} /> {a}
                </li>
              ))}
              <li>
                <Icon name="check" size={16} /> {trip.boardBasis}
              </li>
            </ul>
          </section>

          <section className="trip__section card" aria-labelledby="itinerary-title">
            <h2 id="itinerary-title">Sample itinerary</h2>
            <ol className="itinerary">
              {trip.itinerary.map((day) => (
                <li key={day}>{day}</li>
              ))}
            </ol>
          </section>

          <section className="trip__section card" aria-labelledby="dest-title">
            <h2 id="dest-title">About {destination.name}</h2>
            <p>{destination.summary}</p>
            <p className="muted">Best for: {destination.bestFor.join(', ')}.</p>
            <div className="climate" aria-label="Average daytime temperature by month">
              {Object.entries(destination.temperatureByMonth).map(([m, t], i) => (
                <div key={m} className={`climate__bar${m === month ? ' is-selected' : ''}`} title={`${m}: ${t}°C`}>
                  <span className="climate__fill" style={{ height: `${Math.max(12, (t / 42) * 100)}%` }} />
                  <span className="climate__label">{MONTH_SHORT[i]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="trip__aside">
          <AskAboutTrip tripId={trip.id} destinationName={destination.name} preferences={preferences} />
          <div className="trip__book card">
            <p className="trip__book-price">
              <span className="trip__price">{formatPrice(trip.price)}</span> pp
            </p>
            <button type="button" className="btn btn-primary" disabled aria-describedby="book-note">
              Book this trip
            </button>
            <p id="book-note" className="muted trip__book-note">
              Booking is out of scope for this prototype.
            </p>
            <DemoNotice />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="trip__similar" aria-labelledby="similar-title">
          <h2 id="similar-title">Similar options</h2>
          <ul className="results__grid">
            {similar.map((s) => (
              <li key={s.trip.id}>
                <TravelCard ranked={s} compact onView={(id) => onViewTrip(id, 'recommendation')} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
