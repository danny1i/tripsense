# TripSense — Conversational Travel Search

> **A technical demonstration prototype.** Demo travel data — prices and availability are illustrative.

**▶ Live demo: <https://danny1i.github.io/tripsense/>** — runs entirely in your browser in Demo Mode (no server, no API key).

TripSense lets people describe the trip they want in plain words — *"I want a cheap 4-day trip somewhere warm in November"* — and uses a tool-using AI agent to find, rank and explain matching trips. You can then refine the search by talking (*"make it cheaper and closer to the beach"*) or with normal filters. Both work on the same search.

It was built to show, in working software, an understanding of **conversational search and agentic AI inside a travel marketplace**, and of the full-stack engineering around it. It is **not** a production travel platform.

---

## Contents

- [Quick start](#quick-start)
- [Features](#features)
- [Technology](#technology)
- [Architecture](#architecture)
- [The AI agent](#the-ai-agent)
- [Demo Mode](#demo-mode)
- [Testing](#testing)
- [Security](#security)
- [Accessibility](#accessibility)
- [Production evolution](#production-evolution)
- [How this prototype maps to the role](#how-this-prototype-maps-to-the-role)
- [Project structure](#project-structure)

---

## Quick start

Needs Node.js 20+ (22 recommended). No API key is needed.

```bash
npm install
npm run dev          # http://localhost:5173 — frontend + BFF API in one process
```

Other ways to run it:

```bash
npm run serve        # production build served by the Node BFF on http://localhost:8080
docker compose up    # same, in a container on http://localhost:8080
docker compose --profile db up   # also starts PostgreSQL with the documented schema + demo seed
```

Then follow the 3–5 minute walkthrough in [`docs/demo-script.md`](docs/demo-script.md).

---

## Features

**Implemented** — everything in this list runs in this repository:

- **Conversational search.** Free text is turned into structured travel intent (month, duration, temperature, budget, beach distance, holiday style, nightlife, family/couple, rating, destination).
- **Tool-using agent** that plans which tools to call, runs them, filters, ranks and explains results.
- **Agent activity panel** showing each high-level step and the tool it used — never hidden reasoning.
- **Conversation memory.** "Make it cheaper", "closer to the beach", "what about Tenerife?" build on the current search. Preferences are shown as chips and can be removed one by one.
- **Traditional filters** (budget, destination, month, duration, temperature, rating, beach distance, holiday type, nightlife, family-friendly) that share the same state as the conversation.
- **Clarifying questions** when the request has nothing to search on ("Help me plan a trip").
- **Transparent ranking** with visible weights and a per-trip score breakdown.
- **No-result recovery.** e.g. *"I found 0 options under £200, but there are 2 options between £200–£300"* with one-click ways to broaden.
- **Trip details** with itinerary, amenities, monthly climate, "why this matches", similar options and **Ask AI about this trip** (answers only from the data held).
- **Backend-for-Frontend API** with validation, error mapping, CORS, rate limiting and security headers.
- **Optional real AI model.** With `ANTHROPIC_API_KEY` set on the server, intent extraction uses Claude; any failure falls back to rules.
- **Observability.** Event tracking, structured JSON logs, latency/tool metrics, and a live telemetry panel on the Engineering page.
- **Engineering page** explaining the architecture and what is implemented vs. proposed.
- **Responsive and accessible** on mobile, tablet and desktop.
- **Tests:** unit, integration (over real HTTP), component, end-to-end (Playwright) and automated accessibility (axe-core) on desktop and mobile.
- **Docker** image and `docker-compose.yml`; **PostgreSQL schema** with a generated seed.

**Production design only** (documented, not deployed): AWS hosting, CloudFormation stacks in `infra/` (lint-checked, not deployed), Java/Spring Boot services, A/B testing platform, SLOs.

---

## Technology

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 19, TypeScript (strict), Vite, modern CSS | Fast, typed, no CSS framework needed for a small design system |
| Fonts | Inter (body, 17px base) and Fraunces (headings), self-hosted | Readable body text; distinctive headings; no third-party font calls |
| BFF | Node.js + TypeScript (`node:http`), Zod validation | Same language as the UI, shared types; framework-agnostic controller |
| Agent | TypeScript orchestrator + typed tools over a `TravelProvider` interface | Tools can be backed by real APIs later without changing the agent |
| Optional AI | Anthropic SDK (Claude), server-side only, structured JSON output | Better language understanding when a key is available |
| Data | Typed in-memory demo data; PostgreSQL schema + seed | Runs anywhere; shows the production data model |
| Tests | Vitest, Testing Library, Playwright, axe-core | Fast unit/integration tests plus real-browser journeys |
| Packaging | Docker, docker compose, GitHub Actions | One-command start; CI on every change |

---

## Architecture

```text
Browser ─ React / TypeScript (feature modules: Search · Conversation · Results · Trip Details · Recommendations)
   │  fetch /api/*
   ▼
BFF (src/bff/controller.ts, server/app.ts)
   │  validate (Zod) → orchestrate → shape response → map errors
   ▼
TravelAgent (src/agent/agent.ts)
   │  intent → plan → tools → filter → rank → compare → respond
   ▼
Tools (src/agent/tools.ts)
   │  searchDestinations · searchFlights · searchHotels · searchPackages · getDestinationDetails · compareTravelOptions
   ▼
TravelProvider (src/providers/travelProvider.ts)  ── today: MockTravelProvider over src/data
                                                  ── production: Java/Spring Boot travel services + RDS
```

- **Controller → Service → Agent → Provider → Data.** The BFF controller is a plain function `(method, path, body) → (status, body)`. The Node server, the Vite dev server and the in-browser fallback all call the same controller, so behaviour is identical everywhere.
- **Stateless BFF.** The client sends the current preference state with each message, so any server instance can answer any request — ready for horizontal scaling.
- **BFF endpoints:**

| Method & path | Purpose |
| --- | --- |
| `POST /api/conversation` | Send a message; returns reply, merged preferences, changes, ranked results, agent steps, suggestions |
| `POST /api/search` | Structured search used by filters and chips |
| `GET /api/trips/:id` | Trip details, score for the current preferences, similar options |
| `POST /api/trips/:id/questions` | "Ask AI about this trip" |
| `GET /api/recommendations?tripId=` | Similar trips that still fit the preferences |
| `POST /api/events` | Analytics events (logged as structured JSON) |
| `GET /api/health` | Health and AI mode |

- **Micro-frontend readiness.** Each feature lives in its own folder with its own styles and talks to the rest through props and the API client. These boundaries could evolve into independently deployed micro-frontends inside a larger marketplace. They are deliberately **not** split into separate deployments here — that would add complexity without adding anything to the demo.

Full details: [`docs/architecture.md`](docs/architecture.md).

---

## The AI agent

```text
User request → Intent extraction → Decide what's needed → Select tools → Execute tools → Evaluate → Rank → Respond
```

1. **Intent extraction** (`src/agent/intent.ts`) turns text into a `ParsedIntent`: absolute constraints (`set`), removals, relative changes (`cheaper`, `closerToBeach`…), mode (`new` / `refine` / `reset`), focus (packages / hotels / flights) and whether it is a question about the results. It never invents information.
2. **Context merge** (`src/agent/context.ts`) combines it with the current search. Relative changes are resolved against what's on screen — "cheaper" with no budget sets the budget to the median visible price rounded to £50.
3. **Plan and tools** (`src/agent/agent.ts`):
   - A named destination → `getDestinationDetails` (skip destination search).
   - Otherwise → `searchDestinations` by weather, region and beach.
   - Always → `searchFlights` for flight times (non-critical; if it fails the search continues).
   - Hotel-only request → `searchHotels`; otherwise → `searchPackages`.
   - Filter → rank → `compareTravelOptions` for the top picks.
   - No results → look for the single change that would help most and offer it.
4. **Response** — a short reply, the change list ("Under £400", "Beach within 1 km"), follow-up suggestions and the step log.

Every tool call is timed and recorded. Critical tool failures become a friendly *"Travel search is temporarily unavailable"*; non-critical ones are shown as a skipped step.

**Ranking (demonstration model, not a commercial algorithm):** budget 30% · preference 25% · destination 20% · rating 15% · convenience 10%. See `src/agent/ranking.ts`.

---

## Demo Mode

The whole app works **without any API key or paid service**:

- Intent extraction uses deterministic rules.
- Travel data is local (`src/data`) — 12 destinations, 37 packages, monthly climate.
- Tool execution, conversation context and responses are real code paths, not canned screens.
- Short delays reveal agent steps one by one so the workflow is visible (skipped with *reduced motion*).

If no BFF is reachable (e.g. the built files are opened from a static host), the frontend runs the same BFF controller inside the browser and the header shows *"running in browser"*.

**Optional AI mode:** copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The server then asks Claude (default `claude-opus-5-5`, low effort, JSON-schema output) to extract intent. Output is validated with Zod; on any error, timeout or refusal the agent falls back to rules and the activity log says so. The key is read only by the server and is never sent to the browser.

---

## Testing

```bash
npm test             # unit + integration + component (Vitest)
npm run test:e2e     # Playwright on desktop + mobile against the production build
npm run lint
npm run typecheck
npm run test:all     # everything
```

| Suite | Covers |
| --- | --- |
| `tests/unit/intent.test.ts` | "Find somewhere warm under £400" → `temperature = warm`, `budget ≤ 400`; durations, destinations, relative phrases, questions, invalid input |
| `tests/unit/context.test.ts` | "warm" → "make it cheaper" keeps context; combining preferences; removals |
| `tests/unit/ranking.test.ts` | Budget filtering, temperature by month, beach distance, beach prioritisation, cheap ranking, score bounds |
| `tests/unit/tripQA.test.ts` | Trip answers come only from data; unknown questions are admitted, not invented |
| `tests/integration/agent.test.ts` | Tool order, hotel flow, full demo refinement, clarification, no-results suggestions, tool failure, AI failure fallback |
| `tests/integration/bff-http.test.ts` | Real HTTP server: endpoints, validation, 404/415/400, CORS, analytics |
| `tests/integration/errors.test.ts` | Provider outage → 503, AI failure → still 200, unexpected error → generic 500 without details |
| `tests/component/*` | Preference chips and travel card behaviour |
| `tests/e2e/journey.spec.ts` | Search → Agent → Results → Refinement → Trip details → Ask AI → Engineering; filters + chips; no-results; invalid input; keyboard-only |
| `tests/e2e/accessibility.spec.ts` | axe-core WCAG 2.x A/AA checks on every main screen |

---

## Security

- No secrets in source. `.env` and `.env.*` are git-ignored; `.env.example` holds placeholders only.
- The AI key is only read on the server (`server/config.ts`) and never sent to the browser.
- All request bodies, ids and query strings are validated with Zod (`src/bff/schemas.ts`); unknown fields are rejected; control characters are stripped; message length is capped; bodies over 32 KB are refused.
- User text is only rendered as React text (no `dangerouslySetInnerHTML`).
- Errors map to friendly messages; stack traces are never returned.
- CORS allows only configured origins (`ALLOWED_ORIGINS`).
- Security headers: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Simple per-IP rate limit (production would use API Gateway throttling / WAF).
- Container runs as a non-root user. `npm audit` is part of CI.

---

## Accessibility

Targets WCAG 2.2 AA: semantic landmarks and headings, a skip link, labelled inputs, visible focus rings, keyboard-operable everything, live regions for conversation and result counts, colour pairs that meet AA contrast, reduced-motion support, accessible error messages, and no horizontal scrolling at 320px+. Checked automatically with axe-core in the Playwright suite.

---

## Production evolution

See [`docs/production-evolution.md`](docs/production-evolution.md) and [`docs/architecture.md`](docs/architecture.md). In short:

```text
React / MFE → CloudFront → API Gateway → BFF (ECS Fargate) → AI agent + Java/Spring Boot search, hotel and flight services → RDS PostgreSQL
```

with Secrets Manager, IAM least privilege, CloudWatch logs/metrics/alarms, autoscaling and multi-AZ resilience. Representative CloudFormation is in [`infra/cloudformation`](infra/cloudformation) — **illustrative, not deployed**.

---

## How this prototype maps to the role

**Implemented** = runs in this repo today. **Partly implemented** = a working slice exists; the rest is documented. **Production design** = documented only.

| Role requirement | Demonstrated by | Status |
| --- | --- | --- |
| Full-stack engineering | React frontend + Node/TypeScript BFF API + agent layer | Implemented |
| JavaScript/TypeScript | Strict TypeScript across UI, BFF and agent | Implemented |
| React/Vue | React 19 with feature-based components and hooks | Implemented |
| HTML/CSS | Responsive, accessible UI with semantic HTML and modern CSS | Implemented |
| Java | Spring Boot service design in `docs/production-evolution.md` | Production design |
| REST APIs | Prototype BFF: `/api/conversation`, `/api/search`, `/api/trips`, `/api/recommendations` | Implemented |
| Agentic AI | Tool-using agent with planning, tool calls, fallbacks and activity log | Implemented |
| AWS | Production architecture in `docs/architecture.md` | Production design |
| CloudFormation | `infra/cloudformation` templates, cfn-lint clean, not deployed | Production design |
| Unit testing | Vitest tests for intent, ranking, filtering, context, Q&A | Implemented |
| Integration testing | Agent + provider tests and BFF tests over real HTTP; Playwright journeys | Implemented |
| SQL/data modelling | Typed data model + PostgreSQL schema and generated seed (`db/`); app does not query the DB yet | Partly implemented |
| Git | Focused commits | Implemented |
| Docker | Dockerfile + docker-compose (app, optional Postgres) | Implemented |
| CI/CD | GitHub Actions: audit, lint, typecheck, tests, e2e, cfn-lint, Docker smoke test; deploy stage proposed | Partly implemented |
| Monitoring | Structured logs, event tracking, latency/tool metrics; SLOs and alarms proposed | Partly implemented |
| Scalability | Stateless BFF; scaling plan in docs | Production design |
| MFE | Modular feature boundaries (no separate deployments) | Partly implemented |
| Recommendation systems | Transparent weighted ranking + similar-trip recommendations | Implemented |
| Analytics | Lightweight event tracking abstraction | Implemented |
| A/B testing | Experimentation design in `docs/architecture.md` | Production design |
| Global user base | CDN, multi-AZ, resilience and localisation considerations | Production design |

The same table, with live status badges, is on the in-app **Engineering** page.

---

## Project structure

```text
.
├── src/
│   ├── agent/          intent, context, tools, ranking, trip Q&A, TravelAgent orchestrator
│   ├── bff/            framework-agnostic controller + Zod schemas
│   ├── providers/      TravelProvider interface + MockTravelProvider
│   ├── data/           demo destinations and packages
│   ├── types/          shared domain + API types
│   ├── services/       API client (with in-browser fallback), analytics, session
│   ├── hooks/          conversation/search state, hash router, reduced motion
│   ├── components/     Chat, Search, Results, TravelCard, Filters, AgentActivity, TripDetails, Preferences, Engineering, Layout…
│   ├── pages/          Landing, Search, Engineering
│   └── App.tsx
├── server/             Node HTTP server, config, optional Claude intent extractor
├── tests/              unit · integration · component · e2e
├── db/                 schema.sql, generated seed.sql, generator
├── infra/cloudformation/   illustrative AWS templates (not deployed)
├── docs/               architecture.md · demo-script.md · production-evolution.md
├── Dockerfile · docker-compose.yml · .env.example
```
