# Research: Hotel Search

**Date**: 2026-10-29

No `NEEDS CLARIFICATION` items remain in the plan; R1 has been decided (Option A). Versions of libraries are intentionally not pinned here: they must be looked up and recorded when the project is scaffolded, because this research was not checked against live package registries.

## R1. TypeScript client generator (DECIDED: Option A, `openapi-typescript` + `openapi-fetch`)

Requirement: the frontend uses a TypeScript client generated from the backend OpenAPI document and never hand-writes API types (constitution Principle II).

| | Option A: `openapi-typescript` + `openapi-fetch` | Option B: `@hey-api/openapi-ts` |
|---|---|---|
| What it generates | Types only (a single `.d.ts` of `paths` and `components`). Calls go through a small typed `fetch` wrapper (`openapi-fetch`) that is not generated. | Types plus generated SDK functions (one function per operation) and, depending on configuration, a fetch client. |
| Runtime code shipped | A small runtime library (`openapi-fetch`); generated file has no runtime code. | Generated functions and client plumbing become part of the app. |
| Call style | `client.GET("/api/v1/hotels/search", { params: { query } })`; path and params are type-checked against the document. | `searchHotels({ query })`; operation names come from the OpenAPI `operationId`. |
| Server vs browser use | Works in Server Components and the browser; base URL is a constructor option, so a server base URL and a browser same-origin `/api` are both easy. | Same, via client configuration. |
| Error responses | Typed per status code in the response (`error` is the union of declared error bodies). | Typed per status code; behavior depends on config (throw vs return). |
| Moving parts to approve | 2 packages (1 dev, 1 runtime). | 1 dev package (client runtime is generated or bundled in recent versions; verify when installing). |
| Maturity risk | Stable major version; mostly a types transformer, so little to break. | Active development with a plugin system; the project has had frequent breaking changes between releases, so upgrades can need generated-code changes. |
| Fit for this app | One endpoint today; typed `GET` with typed errors is all that is needed. | More machinery than one endpoint needs; becomes attractive with many operations or if SDK-style functions are preferred. |

**Decision: Option A** (chosen by the project owner, matching the original recommendation). It has the least generated code, no generated runtime to review, and the error union gives the frontend a typed `code` for the message mapping. Cost: two packages instead of one. Option B was not chosen; it remains an option to revisit if the API grows to many operations.

Orval was also considered and not shortlisted: it generates heavier output (and typically pulls in a data-fetching library) than this app needs.

## R2. Pagination

- **Decision**: Keyset pagination ordered by the chosen sort column then hotel id; page size 20; opaque cursor (base64url of the last row's sort value, id and sort name).
- **Rationale**: Stable under concurrent data changes, no offset scans, matches your requirement. Binding the sort name into the cursor catches a cursor reused after the sort changed.
- **Alternatives**: Offset/limit (rejected: you asked for keyset; also unstable pages). Page numbers (rejected: UI is "load more", not pages).
- **Detail**: Row-value comparison is used for the keyset predicate, e.g. `(price_per_night_cents, id) > (:p, :id)` for price ascending and `<` for descending. Because both columns use the same direction, one composite index serves both directions. Star sorts use `(star_rating, id)` the same way, with the id as the only tie-breaker (a secondary price order within one star level was rejected to keep the predicate to a single row comparison).

## R3. Error shape

- **Decision**: `application/problem+json` (RFC 9457, Spring `ProblemDetail`) extended with `code` and `errors[]` of `{ field, code, meta }`.
- **Rationale**: Built into Spring, standard, and the frontend can map `code` to the exact spec messages; `meta` carries values such as the guest range so the limit is not duplicated in the frontend. Returning all violations at once lets the form highlight several fields in one round trip.
- **Alternatives**: Custom ad-hoc JSON (rejected: reinvents ProblemDetail). One error per response (rejected: forces repeated submits).

## R4. Data access: Server Component and "load more"

- **Decision**: The Server Component calls the API directly using a server-side base URL (environment variable). The browser-side "load more" calls the same API through a same-origin Next.js rewrite (`/api/*`), so no CORS configuration is needed in the API.
- **Rationale**: One generated client with two base URLs; no new dependency; no CORS surface to maintain.
- **Alternatives**: CORS on the API (works, but adds a config to keep in sync with ports/hosts). A Next.js Route Handler per call (more code, duplicates the contract).
- **Caching**: Server fetches use `cache: 'no-store'`. This keeps the "no caching layer" constraint literal, including Next.js's own data cache.

## R5. Data access in the API

- **Decision**: Spring `JdbcClient` with explicit SQL.
- **Rationale**: The core of this feature is a hand-shaped keyset query with an `NOT EXISTS` overlap check and dynamic filters. Explicit SQL is easiest to read, test and `EXPLAIN`. Avoids ORM mapping and lazy-loading concerns for a read-only feature.
- **Alternatives**: Spring Data JPA (more dependency and mapping for no benefit here; dynamic keyset predicates need custom queries anyway). jOOQ (extra dependency, build-time code generation). Revisit when write features (booking) arrive.

## R6. OpenAPI generation and drift protection

- **Decision**: springdoc (`webmvc-api`, no UI) serves the document at runtime; a test downloads it from the running application and compares with the committed snapshot `apps/api/openapi/openapi.json`. A Gradle task refreshes the snapshot deliberately.
- **Rationale**: Honors "generated from code" with no build plugin that must start the application. Drift between code and committed document fails the build; the frontend generates its client from the committed snapshot, so the web build does not need the API running.
- **Alternatives**: `springdoc-openapi-gradle-plugin` (starts the app during the build, which needs the database; extra plugin). Generating the client from the live URL (couples the web build to a running API).

## R7. Availability overlap

- **Decision**: Stay is `[checkIn, checkOut)`; unavailable ranges are stored half-open `[start_date, end_date)`; a hotel is excluded when `start_date < checkOut AND end_date > checkIn`.
- **Rationale**: Matches hotel practice (check-out day is not an occupied night) and avoids off-by-one ambiguity; back-to-back stays and ranges are allowed. Tests cover the boundary days.
- **Alternatives**: Inclusive ranges on both ends (rejected: makes same-day turnover impossible).

## R8. "Today" and time zone

- **Decision**: An injectable `Clock` bean with a configured zone (default UTC). `checkIn >= today` in that zone. Tests inject a fixed clock.
- **Rationale**: Deterministic tests; one definition of "today". The known limitation (user in a different zone near midnight) is accepted for a sample-data project.
- **Alternative**: Client sends its local date (rejected: server cannot trust it and the rule then differs by client).

## R9. Hotel images

- **Decision**: A small set of static images under `apps/web/public/images/hotels/`, referenced by relative path in seed data and rendered with `next/image` (already part of Next.js).
- **Rationale**: No external host, no `remotePatterns` configuration, works offline, deterministic e2e runs.
- **Alternatives**: Remote stock-photo URLs (flaky, licensing and hosting concerns). Images served by the API (new endpoint, out of scope).
- **Note**: Placeholder images are created during implementation; licensing is not an issue if they are generated or self-made.

## R10. Measuring performance (SC-001, SC-002)

- **Decision**: Measure first, without a load-testing dependency. The quickstart gives a repeatable `curl` timing loop against the search endpoint (API time) and a Playwright assertion that results are visible within 2 seconds (end-to-end sanity). Results are recorded in the PR or tasks notes.
- **Rationale**: Matches "performance will be measured first; caching is a separate, later change". A dedicated tool (for example k6) can be proposed later if the numbers justify it.
- **Alternatives**: k6 or Gatling now (new tool for a 250-row dataset, not justified yet).

## R11. Test data strategy

- **Decision**: The Flyway seed migration is for development and the Playwright flow. Backend integration tests truncate seed tables and insert purpose-built fixtures with a fixed clock.
- **Rationale**: Boundary cases (overlap edges, ties on price and stars, more than 20 results for cursor continuity) need exact data; seed data is generated and its dates age.
- **Seed note**: Unavailable ranges in the seed use fixed far-future dates (including one all-hotels blackout window for a single city), so end-to-end tests stay valid for a long time but are not literally permanent; the quickstart documents the dates.

## R12. City matching

- **Decision**: Exact, trimmed, case-insensitive match against `city.name` (functional unique index on `lower(name)`).
- **Rationale**: Simple, predictable, testable; the spec's message already tells the user to check the spelling.
- **Alternatives**: Fuzzy/prefix/autocomplete (a good later enhancement, out of scope for this spec).
