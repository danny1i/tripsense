import { DESTINATIONS } from '../data/destinations';
import { SearchBox, SuggestedPrompts } from '../components/Search/SearchBox';
import { DestinationArt } from '../components/DestinationArt/DestinationArt';
import { InsightCards } from '../components/Engineering/Engineering';
import { DemoNotice } from '../components/Layout/Layout';
import { Icon } from '../components/Icon/Icon';
import './pages.css';

const FEATURED = ['tenerife', 'lisbon', 'marrakech', 'malta'];

interface Props {
  onSearch: (text: string) => void;
  onOpenEngineering: () => void;
}

export function LandingPage({ onSearch, onOpenEngineering }: Props) {
  const featured = FEATURED.map((id) => DESTINATIONS.find((d) => d.id === id)).filter((d) => d !== undefined);

  return (
    <>
      <section className="hero">
        <div className="hero__backdrop" aria-hidden="true" />
        <div className="container hero__inner">
          <p className="eyebrow">Conversational travel search</p>
          <h1 className="hero__title">Where do you want to go?</h1>
          <p className="hero__subtitle">Tell us what you’re looking for and we’ll help you find the right trip.</p>
          <div className="hero__search">
            <SearchBox onSubmit={onSearch} autoFocus />
          </div>
          <SuggestedPrompts onPick={onSearch} label="Not sure? Try one of these" />
          <DemoNotice />
        </div>
      </section>

      <section className="section" aria-labelledby="featured-title">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Ideas for November sun</p>
            <h2 id="featured-title">Popular right now</h2>
          </div>
          <ul className="featured">
            {featured.map((d) => (
              <li key={d.id}>
                <button type="button" className="featured__card card" onClick={() => onSearch(`What about ${d.name} in November?`)}>
                  <span className="featured__art">
                    <DestinationArt destination={d} />
                  </span>
                  <span className="featured__body">
                    <span className="featured__name">{d.name}</span>
                    <span className="featured__meta">
                      <Icon name="sun" size={16} /> {d.temperatureByMonth.November}°C in November · {d.flightHoursFromLondon}h flight
                    </span>
                    <span className="featured__summary">{d.summary}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="how-title">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title">Search the way you’d ask a friend</h2>
          </div>
          <ol className="how">
            <li className="card">
              <span className="how__num">1</span>
              <h3>Describe your trip</h3>
              <p>“A cheap 4-day trip somewhere warm in November.” No forms needed.</p>
            </li>
            <li className="card">
              <span className="how__num">2</span>
              <h3>The agent does the legwork</h3>
              <p>It reads your preferences, picks the right tools and searches destinations, flights and hotels.</p>
            </li>
            <li className="card">
              <span className="how__num">3</span>
              <h3>Refine naturally</h3>
              <p>“Make it cheaper and closer to the beach.” It remembers what you said — or use the filters.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="eng-title">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">For the technical reviewer</p>
            <h2 id="eng-title">Engineering behind the experience</h2>
            <p>What is implemented in this prototype, and how it would evolve into a production platform.</p>
          </div>
          <InsightCards />
          <button type="button" className="btn btn-secondary engineering-link" onClick={onOpenEngineering}>
            See the architecture <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </section>
    </>
  );
}
