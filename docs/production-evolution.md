# TripSense — Production evolution

> **Production design.** Nothing in this document is deployed. It describes how the prototype would grow into a production platform, and what would change.

## 1. Target shape

```text
React / TypeScript (micro-frontends)
        ↓
BFF (TypeScript or Java, per team preference)
        ↓
Java / Spring Boot services: Search · Agent · Trips · Users
        ↓
Travel services (flight, hotel and package suppliers)
        ↓
PostgreSQL (RDS) · Redis (ElastiCache) · S3
```

The prototype already has the seams this needs:

| Prototype seam | Becomes |
| --- | --- |
| `TravelProvider` interface (`src/providers`) | HTTP clients for the Search Service and supplier APIs |
| `IntentExtractor` interface (`src/agent/intent.ts`) | LLM-backed extractor with rules as fallback (already implemented behind an env var) |
| Tool functions (`src/agent/tools.ts`) | Tool endpoints on backend services; schemas reusable as LLM tool definitions |
| Framework-agnostic BFF controller | BFF service behind API Gateway |
| `db/schema.sql` | Flyway migrations in the Search Service |
| Analytics `track()` | Event pipeline (Firehose → S3 → warehouse) |

## 2. Java / Spring Boot services

### Search Service (example)

```text
search-service/
├── api/        SearchController (REST, OpenAPI)          → POST /v1/packages:search
├── service/    PackageSearchService, RankingService
├── domain/     Destination, Hotel, Package, Money, Month
├── adapter/    SupplierClient (WebClient + Resilience4j), PackageRepository (Spring Data JDBC)
└── resources/  db/migration (Flyway, from db/schema.sql)
```

```java
@RestController
@RequestMapping("/v1/packages")
class SearchController {
    private final PackageSearchService search;

    @PostMapping(":search")
    SearchResponse search(@Valid @RequestBody SearchRequest request) {
        return search.search(request.toCriteria());
    }
}

record SearchRequest(
    @Size(max = 12) List<@Pattern(regexp = "[a-z0-9-]{1,40}") String> destinationIds,
    Month month,
    @Min(1) @Max(30) Integer durationDays,
    @Min(50) @Max(20000) Integer budgetMaxGbp,
    Integer beachMaxDistanceMetres,
    Set<HolidayType> holidayTypes) { … }
```

- **Validation** with Jakarta Bean Validation (mirrors the Zod schemas).
- **Resilience4j** circuit breakers, timeouts and bulkheads around supplier calls.
- **Spring Data JDBC** queries using the indexes in `db/schema.sql`.
- **Micrometer → CloudWatch** metrics; OpenTelemetry traces; structured logs (Logback JSON).
- **Testing:** JUnit 5 unit tests, Testcontainers (PostgreSQL) integration tests, Pact contract tests between BFF and services.

### Agent Service

- Runs the plan → tools → evaluate loop. With an LLM, tools are exposed as JSON-schema tool definitions generated from the same contracts as `TOOL_CATALOGUE`.
- Hard limits: max tool calls per turn, per-call timeouts, token budget, and a deterministic fallback path (the rule-based planner the prototype uses today).
- Guardrails: tool inputs validated before execution; answers grounded only in tool results; user content never placed into system instructions.
- Evaluation: an offline set of real anonymised queries with expected structured intents, run in CI to catch regressions when prompts or models change.

## 3. Data

- Move from in-memory data to PostgreSQL (`db/schema.sql`), prices as integer minor units with a currency code.
- Supplier availability and prices are volatile: cache with short TTLs in Redis, refresh asynchronously, and always re-price at booking time.
- Conversation context stays client-held or moves to Redis keyed by session for multi-device continuity.

## 4. Delivery

**Implemented:** GitHub Actions (`.github/workflows/ci.yml`) runs `npm audit`, lint, typecheck, unit/integration/component tests, Playwright e2e + accessibility tests, `cfn-lint`, and a Docker build + container smoke test.

**Proposed:**

1. On merge to `main`: build and push the image to Amazon ECR (GitHub OIDC → IAM role, no stored keys).
2. Deploy to staging with CloudFormation; run smoke and e2e tests against staging.
3. Promote to production with ECS rolling deployment + circuit breaker (or CodeDeploy blue/green).
4. Feature flags (AWS AppConfig) for risky changes and experiments.

Agile delivery: small vertical slices behind flags, trunk-based development, CI as the gate, observability dashboards reviewed after each release.

## 5. Suggested next steps for the prototype

1. Point `TravelProvider` at the PostgreSQL schema (already seeded) to prove the data path.
2. Stream agent steps to the UI with Server-Sent Events instead of revealing them after the response.
3. Use the LLM for response wording as well as intent extraction, with the current templates as fallback.
4. Add an offline intent-extraction evaluation set and run it in CI.
5. Add user accounts and saved searches (User Service).
