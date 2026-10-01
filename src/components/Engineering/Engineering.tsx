import { useEffect, useState } from 'react';
import { TOOL_CATALOGUE } from '../../agent/tools';
import { RANKING_WEIGHTS } from '../../agent/ranking';
import { getEventHistory, getMetrics, subscribeToEvents } from '../../services/analytics';
import { Icon, type IconName } from '../Icon/Icon';
import './Engineering.css';

type Status = 'implemented' | 'design' | 'partial';

function StatusBadge({ status }: { status: Status }) {
  if (status === 'implemented') return <span className="badge badge-implemented">Implemented</span>;
  if (status === 'partial') return <span className="badge badge-neutral">Partly implemented</span>;
  return <span className="badge badge-design">Production design</span>;
}

export const INSIGHTS: { title: string; body: string; icon: IconName; status: Status }[] = [
  { title: 'Conversational Search', body: 'Natural-language requests are converted into structured travel intent.', icon: 'search', status: 'implemented' },
  { title: 'Agentic AI', body: 'The AI can select and orchestrate tools instead of simply generating text.', icon: 'sparkle', status: 'implemented' },
  { title: 'BFF', body: 'Frontend requests are handled through a backend-for-frontend layer.', icon: 'plane', status: 'implemented' },
  { title: 'Modular Frontend', body: 'Feature boundaries support future micro-frontend evolution.', icon: 'filter', status: 'implemented' },
  { title: 'Recommendation Logic', body: 'Results are ranked according to transparent demonstration criteria.', icon: 'star', status: 'implemented' },
  { title: 'Observability', body: 'Search and agent activity can be measured.', icon: 'clock', status: 'partial' },
  { title: 'Scalable Architecture', body: 'The prototype can evolve towards independently scalable services on AWS.', icon: 'refresh', status: 'design' },
];

export function InsightCards({ limit }: { limit?: number }) {
  return (
    <ul className="insights">
      {INSIGHTS.slice(0, limit).map((item) => (
        <li key={item.title} className="insight card">
          <span className="insight__icon" aria-hidden="true">
            <Icon name={item.icon} size={20} />
          </span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
          <StatusBadge status={item.status} />
        </li>
      ))}
    </ul>
  );
}

const LAYERS: { name: string; detail: string; status: Status }[] = [
  { name: 'React / TypeScript', detail: 'Feature modules: Search · Conversation · Results · Trip Details · Recommendations', status: 'implemented' },
  { name: 'BFF', detail: '/api/conversation · /api/search · /api/trips · /api/recommendations — validation, orchestration, response shaping, errors', status: 'implemented' },
  { name: 'Agentic AI', detail: 'Intent extraction (rules or optional Claude model) → plan → tool calls → evaluate → rank → respond', status: 'implemented' },
  { name: 'Tools', detail: 'searchDestinations · searchFlights · searchHotels · searchPackages · getDestinationDetails · compareTravelOptions', status: 'implemented' },
  { name: 'Travel Services', detail: 'Today: TravelProvider over local demo data. Production: Java / Spring Boot search, hotel and flight services', status: 'partial' },
  { name: 'AWS', detail: 'CloudFront · API Gateway · ECS Fargate · RDS · Secrets Manager · CloudWatch (CloudFormation examples in /infra)', status: 'design' },
];

export function ArchitectureFlow() {
  return (
    <ol className="arch-flow" aria-label="Architecture from frontend to cloud">
      {LAYERS.map((layer, index) => (
        <li key={layer.name} className="arch-flow__item">
          <div className={`arch-flow__node card is-${layer.status}`}>
            <div className="arch-flow__head">
              <h3>{layer.name}</h3>
              <StatusBadge status={layer.status} />
            </div>
            <p>{layer.detail}</p>
          </div>
          {index < LAYERS.length - 1 && (
            <span className="arch-flow__arrow" aria-hidden="true">
              <Icon name="chevronDown" size={22} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function ToolCatalogue() {
  return (
    <div className="table-wrap card" role="region" aria-label="Agent tools (scrollable)" tabIndex={0}>
      <table className="data-table">
        <caption className="visually-hidden">Agent tools</caption>
        <thead>
          <tr>
            <th scope="col">Tool</th>
            <th scope="col">What it does</th>
          </tr>
        </thead>
        <tbody>
          {TOOL_CATALOGUE.map((t) => (
            <tr key={t.name}>
              <td>
                <code>{t.signature}</code>
              </td>
              <td>{t.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RankingWeights() {
  const labels: Record<keyof typeof RANKING_WEIGHTS, string> = {
    budget: 'Budget match',
    preference: 'Preference match',
    destination: 'Destination match',
    rating: 'Rating',
    convenience: 'Convenience',
  };
  return (
    <ul className="weights card">
      {(Object.keys(RANKING_WEIGHTS) as (keyof typeof RANKING_WEIGHTS)[]).map((key) => (
        <li key={key}>
          <span>{labels[key]}</span>
          <span className="weights__bar" aria-hidden="true">
            <span style={{ width: `${RANKING_WEIGHTS[key] * 100 * 3}%` }} />
          </span>
          <strong>{RANKING_WEIGHTS[key] * 100}%</strong>
        </li>
      ))}
    </ul>
  );
}

export const ROLE_MAPPING: { requirement: string; demonstratedBy: string; status: Status }[] = [
  { requirement: 'Full-stack engineering', demonstratedBy: 'React frontend + Node/TypeScript BFF API + agent layer', status: 'implemented' },
  { requirement: 'JavaScript/TypeScript', demonstratedBy: 'Strict TypeScript across UI, BFF and agent', status: 'implemented' },
  { requirement: 'React/Vue', demonstratedBy: 'React 19 with feature-based components and hooks', status: 'implemented' },
  { requirement: 'HTML/CSS', demonstratedBy: 'Responsive, accessible UI with semantic HTML and modern CSS', status: 'implemented' },
  { requirement: 'Java', demonstratedBy: 'Documented Spring Boot service design (docs/production-evolution.md)', status: 'design' },
  { requirement: 'REST APIs', demonstratedBy: 'Prototype BFF: /api/conversation, /api/search, /api/trips, /api/recommendations', status: 'implemented' },
  { requirement: 'Agentic AI', demonstratedBy: 'Tool-using agent with planning, tool calls, fallbacks and activity log', status: 'implemented' },
  { requirement: 'AWS', demonstratedBy: 'Production architecture (docs/architecture.md)', status: 'design' },
  { requirement: 'CloudFormation', demonstratedBy: 'Illustrative templates in infra/cloudformation (not deployed)', status: 'design' },
  { requirement: 'Unit testing', demonstratedBy: 'Vitest tests for intent, ranking, filtering and context', status: 'implemented' },
  { requirement: 'Integration testing', demonstratedBy: 'BFF + agent + provider tests over HTTP; Playwright end-to-end journey', status: 'implemented' },
  { requirement: 'SQL/data modelling', demonstratedBy: 'Typed travel data model + PostgreSQL schema (db/schema.sql)', status: 'partial' },
  { requirement: 'Git', demonstratedBy: 'Clean repository with focused commits', status: 'implemented' },
  { requirement: 'Docker', demonstratedBy: 'Dockerfile + docker-compose (app, optional Postgres)', status: 'implemented' },
  { requirement: 'CI/CD', demonstratedBy: 'GitHub Actions workflow for lint, typecheck, tests and build; deploy stage proposed', status: 'partial' },
  { requirement: 'Monitoring', demonstratedBy: 'Structured logs, event tracking, latency + tool metrics; SLOs proposed', status: 'partial' },
  { requirement: 'Scalability', demonstratedBy: 'Stateless BFF; scaling plan in docs', status: 'design' },
  { requirement: 'MFE', demonstratedBy: 'Modular feature boundaries (no separate deployments yet)', status: 'partial' },
  { requirement: 'Recommendation systems', demonstratedBy: 'Transparent weighted ranking + similar-trip recommendations', status: 'implemented' },
  { requirement: 'Analytics', demonstratedBy: 'Lightweight event tracking abstraction', status: 'implemented' },
  { requirement: 'A/B testing', demonstratedBy: 'Experimentation architecture (docs/architecture.md)', status: 'design' },
  { requirement: 'Global user base', demonstratedBy: 'CDN, multi-AZ and resilience considerations', status: 'design' },
];

export function RoleMappingTable() {
  return (
    <div className="table-wrap card" role="region" aria-label="Role mapping (scrollable)" tabIndex={0}>
      <table className="data-table">
        <caption className="visually-hidden">How this prototype maps to the role</caption>
        <thead>
          <tr>
            <th scope="col">Role requirement</th>
            <th scope="col">Demonstrated by</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {ROLE_MAPPING.map((row) => (
            <tr key={row.requirement}>
              <th scope="row">{row.requirement}</th>
              <td>{row.demonstratedBy}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Live session telemetry from the analytics abstraction. */
export function TelemetryPanel() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeToEvents(() => setTick((t) => t + 1)), []);
  const metrics = getMetrics();
  const events = getEventHistory().slice(-8).reverse();

  const stat = (label: string, value: string | number) => (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <div className="telemetry card">
      <dl className="telemetry__stats">
        {stat('Searches this session', metrics.searches)}
        {stat('Avg. search latency', metrics.averageLatencyMs === null ? '—' : `${metrics.averageLatencyMs} ms`)}
        {stat('Agent tool calls', metrics.toolCalls)}
        {stat('Errors shown', metrics.errors)}
      </dl>
      <div>
        <h3 className="telemetry__title">Recent events</h3>
        {events.length === 0 ? (
          <p className="muted">Run a search to see events appear here.</p>
        ) : (
          <ul className="telemetry__events">
            {events.map((e, i) => (
              <li key={`${e.timestamp}-${i}`}>
                <code>{e.name}</code>
                <span className="muted">{new Date(e.timestamp).toLocaleTimeString('en-GB')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
