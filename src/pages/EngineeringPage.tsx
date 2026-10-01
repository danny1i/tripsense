import { ArchitectureFlow, InsightCards, RankingWeights, RoleMappingTable, TelemetryPanel, ToolCatalogue } from '../components/Engineering/Engineering';
import './pages.css';

export function EngineeringPage() {
  return (
    <div className="container engineering">
      <header className="engineering__intro">
        <p className="eyebrow">Technical overview</p>
        <h1>Engineering behind the experience</h1>
        <p>
          TripSense is a high-fidelity prototype. Everything marked <span className="badge badge-implemented">Implemented</span> runs in this
          repository today. Items marked <span className="badge badge-design">Production design</span> are documented proposals, not deployed
          infrastructure.
        </p>
      </header>

      <section className="engineering__section" aria-labelledby="pillars-title">
        <h2 id="pillars-title">What this prototype demonstrates</h2>
        <InsightCards />
      </section>

      <section className="engineering__section" aria-labelledby="flow-title">
        <h2 id="flow-title">From the browser to the cloud</h2>
        <p className="engineering__lead">
          The prototype proves the user experience end to end. The documented production architecture shows how each layer would evolve.
        </p>
        <ArchitectureFlow />
      </section>

      <section className="engineering__section" aria-labelledby="agent-title">
        <h2 id="agent-title">How the agent works</h2>
        <ol className="agent-steps">
          {['User request', 'Intent extraction', 'Determine required information', 'Select tools', 'Execute tools', 'Evaluate results', 'Rank results', 'Generate response'].map(
            (s, i) => (
              <li key={s}>
                <span>{i + 1}</span> {s}
              </li>
            ),
          )}
        </ol>
        <p className="engineering__lead">
          The agent chooses tools based on the request: a named destination skips destination search and goes straight to destination details; a
          hotel-only request uses <code>searchHotels</code> instead of <code>searchPackages</code>; an empty result triggers a search for close
          alternatives. Users see a high-level activity log — never hidden reasoning.
        </p>
        <ToolCatalogue />
      </section>

      <section className="engineering__section" aria-labelledby="ranking-title">
        <h2 id="ranking-title">Transparent ranking (demonstration model)</h2>
        <p className="engineering__lead">A simple weighted score — not a commercial recommendation algorithm — so every result can explain itself.</p>
        <RankingWeights />
      </section>

      <section className="engineering__section" aria-labelledby="telemetry-title">
        <h2 id="telemetry-title">Observability — live for this session</h2>
        <p className="engineering__lead">
          Events such as <code>search_started</code>, <code>agent_tool_called</code> and <code>trip_selected</code> are tracked and sent to the BFF as
          structured logs.
        </p>
        <TelemetryPanel />
      </section>

      <section className="engineering__section" aria-labelledby="role-title">
        <h2 id="role-title">How this prototype maps to the role</h2>
        <RoleMappingTable />
      </section>
    </div>
  );
}
