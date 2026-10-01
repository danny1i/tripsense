import type { RankedTrip } from '../../types/travel';
import { DestinationArt } from '../DestinationArt/DestinationArt';
import { Icon } from '../Icon/Icon';
import './TravelCard.css';

export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} km` : `${metres}m`;
}

export function formatPrice(value: number): string {
  return `£${value.toLocaleString('en-GB')}`;
}

interface Props {
  ranked: RankedTrip;
  onView: (tripId: string) => void;
  highlight?: string;
  rank?: number;
  compact?: boolean;
}

export function TravelCard({ ranked, onView, highlight, rank, compact = false }: Props) {
  const { trip, destination, score, matchReasons, explanation, temperatureForMonth } = ranked;
  const titleId = `trip-title-${trip.id}`;

  return (
    <article className={`travel-card card${compact ? ' travel-card--compact' : ''}`} aria-labelledby={titleId}>
      <div className="travel-card__media">
        <DestinationArt destination={destination} />
        <span className="travel-card__score" title="Demonstration match score (0–100)">
          {score}% match
        </span>
        {highlight && <span className="travel-card__highlight">{highlight}</span>}
      </div>

      <div className="travel-card__body">
        <header className="travel-card__header">
          <div>
            <h3 id={titleId} className="travel-card__title">
              {rank !== undefined && <span className="visually-hidden">Result {rank}: </span>}
              {destination.name}
            </h3>
            <p className="travel-card__meta">
              {destination.country} · {trip.hotelName}
            </p>
          </div>
          <p className="travel-card__price">
            <span className="travel-card__amount">{formatPrice(trip.price)}</span>
            <span className="travel-card__pp">pp</span>
          </p>
        </header>

        <p className="travel-card__duration">
          {trip.nights} nights · {trip.duration} days · {trip.boardBasis}
        </p>

        <ul className="travel-card__facts" aria-label="Key facts">
          <li>
            <Icon name="sun" size={16} /> {temperatureForMonth}°C
          </li>
          <li>
            <Icon name="star" size={16} /> {trip.hotelRating}/5
          </li>
          <li>
            <Icon name="beach" size={16} /> {trip.beachDistance === null ? 'No beach nearby' : `${formatDistance(trip.beachDistance)} from beach`}
          </li>
        </ul>

        {!compact && (
          <>
            <ul className="travel-card__reasons" aria-label="Why it matches">
              {matchReasons.slice(0, 3).map((reason) => (
                <li key={reason}>
                  <Icon name="check" size={16} /> {reason}
                </li>
              ))}
            </ul>
            <p className="travel-card__why">
              <strong>Why this matches: </strong>
              {explanation}
            </p>
            <ul className="travel-card__tags" aria-label="Holiday type">
              {trip.holidayTypes.slice(0, 3).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        )}

        <button type="button" className="btn btn-secondary travel-card__cta" onClick={() => onView(trip.id)} aria-describedby={titleId}>
          View trip <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </article>
  );
}
