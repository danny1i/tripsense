# TripSense — Architecture

This document has two parts:

1. **[Prototype architecture](#1-prototype-architecture-implemented)** — what runs in this repository today. *Implemented.*
2. **[Proposed production architecture](#2-proposed-production-architecture)** — how it would run on AWS at scale. *Production design — not deployed.*

---

## 1. Prototype architecture (implemented)

```text
┌──────────────────────────── Browser ─────────────────────────────┐
│ React 19 / TypeScript                                             │
│  Search · Conversation · Results · Trip Details · Recommendations  │
│  useTripSearch (preference state)  ·  apiClient  ·  analytics     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ JSON over /api/*
┌───────────────────────────────▼──────────────────────────────────┐
│ BFF  (server/app.ts → src/bff/controller.ts)                      │
│  CORS · rate limit · body limit · security headers                │
│  Zod validation → TravelAgent → response shaping → error mapping  │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│ TravelAgent (src/agent)                                           │
│  IntentExtractor: rules (Demo Mode) or Claude (optional, server)  │
│  context merge → plan → tools → filter → rank → compare → reply   │
└───────────────────────────────┬──────────────────────────────────┘
                                │ typed tool calls
┌───────────────────────────────▼──────────────────────────────────┐
│ Tools: searchDestinations · searchFlights · searchHotels ·        │
│        searchPackages · getDestinationDetails · compareTravelOptions │
└───────────────────────────────┬──────────────────────────────────┘
                                │ TravelProvider interface
┌───────────────────────────────▼──────────────────────────────────┐
│ MockTravelProvider → src/data (12 destinations, 37 packages)      │
│ (db/schema.sql shows the equivalent PostgreSQL model)             │
└──────────────────────────────────────────────────────────────────┘
```

### Request flow: "Make it cheaper and closer to the beach"

1. The UI sends `POST /api/conversation` with the message, the **current preferences** and the ids of the trips on screen. The server keeps no session state.
2. The controller validates the body (unknown fields rejected, length limits, id formats).
3. The agent extracts intent: `relative: { cheaper: true, closerToBeach: true }`, `mode: "refine"`.
4. The context layer resolves the relative words: no budget yet → budget becomes the median visible price rounded up to £50 (£400); no beach distance yet → 1 km.
5. The agent plans tool calls (`searchDestinations` → `searchFlights` → `searchPackages`), filters, ranks and compares.
6. The response includes the reply, the change list, ranked results, comparison highlights, follow-ups and the step log. The UI reveals the steps one by one, then shows the results.

### Why a BFF

The BFF gives the frontend exactly the shape it needs (e.g. `RankedTrip` with explanation and score breakdown) in one call, hides internal services, owns validation and error mapping, and is the one place that holds secrets. In production it would aggregate several backend services and expose frontend-specific APIs.

### Why the controller is framework-agnostic

`createController()` is a plain async function. It is mounted by:

- the production Node server (`server/index.ts`),
- the Vite dev server (`vite.config.ts` plugin) so `npm run dev` is one process,
- the browser, as a fallback when no BFF is reachable.

The same code path is therefore tested once and behaves the same everywhere.

### Frontend feature modules (micro-frontend readiness)

| Module | Folder | Owns |
| --- | --- | --- |
| Search | `components/Search`, `pages/LandingPage` | Conversational entry point, suggested prompts |
| Conversation | `components/Chat`, `hooks/useTripSearch` | Message thread, quick replies, refinement |
| Results | `components/Results`, `TravelCard`, `Filters`, `Preferences`, `AgentActivity` | Result list, filters, chips, agent log |
| Trip Details | `components/TripDetails` | Details, itinerary, Ask AI |
| Recommendations | `TripDetails` "Similar options", `/api/recommendations` | Similar trips |

Modules communicate through props and the typed API client only. In a larger marketplace each could become an independently deployed micro-frontend (e.g. Module Federation or import maps), owned by a separate team, with the BFF contract as the boundary. This prototype deliberately keeps one deployment.

---

## 2. Proposed production architecture

> **Production design — not deployed.** Representative CloudFormation is in [`infra/cloudformation`](../infra/cloudformation).

```text
                     USER
                       │
                       ▼
                  CloudFront ───────────────► S3 (React / MFE bundles)
                       │ /api/*
                       ▼
                 API Gateway (HTTP API, throttling, WAF)
                       │ VPC Link
                       ▼
                     BFF  (ECS Fargate, autoscaled, multi-AZ)
                       │
          ┌────────────┼──────────────┐
          ▼            ▼              ▼
      AI Agent    Search Service   User Service       (Java / Spring Boot on ECS)
          │            │              │
          ▼            ▼              ▼
       AI Tools    Travel APIs     RDS (profiles, saved trips)
       (LLM API)   (flights, hotels, packages)
                       │
                       ▼
                RDS PostgreSQL (Multi-AZ) + ElastiCache (Redis)
```

### AWS services

| Concern | Service | Notes |
| --- | --- | --- |
| Edge / CDN | **CloudFront** | Caches static assets globally; `/api/*` routed to API Gateway; security headers policy |
| Static hosting | **S3** | Private bucket, Origin Access Control |
| API front door | **API Gateway** (HTTP API) | Throttling, access logs, JWT auth when accounts exist; AWS WAF for bot/abuse protection |
| Compute | **ECS on Fargate** | BFF and Java services as containers; no servers to manage; rolling deploys with circuit breaker. Lambda is a good fit for spiky, small functions (e.g. event ingestion) but long-lived LLM calls and connection pooling favour Fargate for the BFF |
| Database | **RDS PostgreSQL** Multi-AZ | Schema in `db/schema.sql`; read replicas for search-heavy traffic |
| Cache | **ElastiCache (Redis)** | Destination/climate data, popular searches, LLM intent cache for repeated phrases |
| Secrets | **Secrets Manager** | AI API key, DB credentials (RDS-managed rotation) injected into tasks at start |
| Identity | **IAM** | Task roles with least privilege; GitHub OIDC for deployments (no long-lived keys) |
| Observability | **CloudWatch** Logs, Metrics, Alarms, Container Insights; **X-Ray**/OpenTelemetry tracing | Structured JSON logs already emitted by the prototype |
| Events | **Kinesis Data Firehose → S3 → Athena** | Analytics and experimentation data |

### Resilience

- Everything runs in at least two Availability Zones (ALB, ECS tasks, RDS Multi-AZ, one NAT per AZ).
- The BFF is stateless; any task can serve any request.
- **Graceful degradation is already in the agent:** a failed non-critical tool (flights) is skipped and shown; a failed AI model falls back to rules; a failed critical tool returns a friendly 503.
- Timeouts and a single retry on outbound AI calls; circuit breakers around third-party travel APIs; bulkheads so a slow supplier cannot exhaust the BFF.
- ECS deployment circuit breaker with automatic rollback; RDS automated backups and point-in-time recovery.

### Scalability

| Technique | How it applies |
| --- | --- |
| Stateless services | Conversation context travels with the request (as in the prototype) or lives in Redis, so services scale horizontally |
| Horizontal autoscaling | ECS target tracking on CPU / request count |
| CDN | Static assets and cacheable destination content served from the edge |
| Caching | Redis for destination data, supplier responses with short TTLs, and repeated intent extractions |
| Database indexing | GIN indexes on months/holiday types, B-tree on price/nights, climate `(month, avg_high_c)` — see `db/schema.sql` |
| Asynchronous processing | Supplier price refresh, analytics and embeddings via queues (SQS) instead of in the request path |
| Rate limiting | API Gateway throttling + WAF rate rules; per-user limits on AI calls to control cost |
| Service isolation | Search, AI agent and user services scale and fail independently |
| Fault tolerance | Multi-AZ, retries with backoff, circuit breakers, fallbacks |
| Observability | Metrics and traces per tool call to find hot spots |
| Micro-frontends | Teams own and deploy Search, Results, Trip Details independently; shared design system; contract tests on BFF APIs |

---

## 3. Observability

**Implemented in the prototype**

- Structured JSON logs for every API request (method, path, status, latency) and every analytics event.
- Event tracking: `search_started`, `search_completed`, `conversation_message_sent`, `agent_tool_called`, `result_viewed`, `filter_applied`, `trip_selected`, `recommendation_clicked` (+ `trip_question_asked`, `error_shown`).
- Per-response telemetry: latency, tool calls, tool errors, intent source (rules or LLM).
- Live session metrics on the Engineering page.

**Proposed production metrics**

| Metric | Source |
| --- | --- |
| Availability | Successful / total API requests (API Gateway, ALB) |
| Latency p50/p95/p99 | API Gateway + per-tool timings |
| Error rate | 5xx / total |
| Agent failure rate | Conversations ending in `ai_unavailable` or `search_unavailable` |
| Tool failure rate | Tool steps with `status: error` / all tool steps |
| LLM fallback rate | Responses with `intentSource: rules` while AI mode is on |
| Zero-result rate | `outcome: no_results` / searches |

**Example SLIs / SLOs — proposed targets, not measured**

| SLI | Proposed SLO |
| --- | --- |
| API availability | 99.9% monthly |
| Conversation latency (p95, server) | < 1.5 s with LLM, < 300 ms in rules mode |
| Search error rate | < 0.5% of requests |
| Tool failure rate | < 1% of tool calls |
| Agent fallback rate | < 5% of AI-mode requests |

---

## 4. Analytics and A/B testing

**Implemented:** a small `track()` abstraction (`src/services/analytics.ts`) that buffers events, sends batches to `POST /api/events`, and logs them as structured JSON.

**Proposed:**

- **Funnel:** `search_started → search_completed (results) → result_viewed → trip_selected → (booking_started → booking_completed)`. Conversion per step, split by entry point (conversation vs. filters) and intent source.
- **Result click-through:** clicks per result position; does the top-ranked result get chosen?
- **Recommendation engagement:** `recommendation_clicked` for similar trips and "broaden search" suggestions.
- **Conversation quality:** refinements per search, clarification rate, zero-result rate, abandonment after a reply.
- **A/B testing:** assign a stable variant per anonymous session at the BFF (hash of session id → bucket), pass it in the response and attach it to every event. Candidate experiments:
  - conversational-first landing vs. form-first landing;
  - ranking weights (e.g. budget 30% vs. 40%);
  - showing vs. hiding the agent activity panel;
  - rules vs. LLM intent extraction (quality and cost).
  Analyse in Athena/warehouse with pre-registered primary metrics (search-to-trip-view rate, booking conversion) and guardrails (latency, error rate). A feature-flag service (e.g. AWS AppConfig) controls rollout.

---

## 5. Global user base

- CloudFront edge caching and HTTP/3 for low latency worldwide; multi-region active-passive for the API if needed.
- Currency and locale come from the provider (`currency` is already part of `TripOption`); prices stored as integer minor units in the database.
- Content and AI prompts localised per market; climate data per hemisphere.
- Data residency handled per region (e.g. EU data in an EU region).
