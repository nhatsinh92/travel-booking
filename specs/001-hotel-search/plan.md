# Implementation Plan: Hotel Search

**Branch**: `001-hotel-search` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-hotel-search/spec.md`

## Summary

Employees search a fixed sample dataset of hotels by city, dates and guest count, then filter, sort and page through the results. This is the first feature, so the plan also creates the monorepo skeleton (web app, API, local database, contract pipeline, test setup) that later features reuse.

Approach: a Next.js Server Component search page renders the first page of results from URL search params by calling a single Spring Boot search endpoint. The endpoint validates input on the server, queries PostgreSQL with keyset pagination (page size 20), and returns either a page of hotels or a consistent error shape. The OpenAPI document is generated from the backend code; the frontend uses a TypeScript client generated from it. No caching layer, authentication or deployment setup is included.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS) for the web app; Java 21 for the API. Exact framework versions are pinned at scaffold time and recorded in the lockfiles.

**Primary Dependencies**: Next.js (App Router), React, Spring Boot 3.x (web, validation, JDBC), Flyway, springdoc-openapi, a generated TypeScript client (`openapi-typescript` + `openapi-fetch`, decided in [research.md](research.md) R1). Full list in [Dependencies for Approval](#dependencies-for-approval).

**Storage**: PostgreSQL 16 (local, via Docker Compose), schema managed by Flyway migrations.

**Testing**: Backend: JUnit 5 + Testcontainers (real PostgreSQL). Frontend: Vitest + Testing Library for components; Playwright for one end-to-end search flow.

**Target Platform**: Local development (Docker Compose for the database, API and web run on the host). No deployment target.

**Project Type**: Web application (monorepo: `apps/web` + `apps/api`).

**Performance Goals**: Results visible within 2 seconds for a typical search (SC-001); filter/sort update within 2 seconds (SC-002). Measured, not assumed (see [quickstart.md](quickstart.md)).

**Constraints**: No caching layer (Cache Components is enabled in `next.config.ts` but no code uses `use cache`; see [Cache Components decision](#cache-components-decision)). No maximum stay length. No authentication. Server validates all input. Page size fixed at 20.

**Scale/Scope**: 5 cities, about 50 hotels per city (about 250 hotels), each with zero or more unavailable date ranges. One search page, one API endpoint.

### Assumptions this plan makes (confirmed by the project owner)

These go beyond what the spec and the original input state. Per the constitution (Principle V) they are stated, not silently decided. All are confirmed; assumption 1 was changed as described. Assumptions 1, 7 and 8 are now also recorded in the spec.

1. **Guest count filters by hotel capacity.** Each hotel has a `max_guests` value; a hotel is returned only when `max_guests >= guests`. `guests` is also validated (1 to 10).
2. **"Today" is evaluated on the server** in one configured time zone (default UTC), through an injectable clock so tests can fix the date. A user near midnight in another time zone may see a boundary difference.
3. **City match** is exact on the trimmed, case-insensitive city name (no fuzzy matching, no accent folding). Anything else gives the "no matching city" message.
4. **Stay semantics**: check-out is the departure day. A stay occupies nights `[checkIn, checkOut)`, and unavailable ranges use the same half-open convention, so a stay ending the day an unavailable range starts is allowed.
5. **Sort options**: price ascending, price descending, stars descending, stars ascending. Default is price ascending. Ties are broken by hotel id.
6. **Price unit**: one currency (USD), stored and returned as integer cents. The UI shows dollars.
7. **Price range validation**: `minPrice` greater than `maxPrice` is rejected as invalid input. The spec does not list this case; the plan adds it as a validation error.
8. **Empty-state choice** is made by the frontend: empty results with any filter active show the "clear filters" state; empty results with no filters show the "try different dates or a smaller number of guests" state. The API returns no total count.
9. **Hotel images** are small static files served by the web app (not remote URLs), so the app works offline and image loading adds no external dependency.
10. **Seed cities**: Hanoi, Ho Chi Minh City, Da Nang, Singapore, Bangkok. Say if you want different ones.
11. **"Load more" state is not stored in the URL.** Back/refresh returns to the first page of the same search; criteria, filters and sort are in the URL.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Spec-First | Spec exists under `specs/001-hotel-search/` and now includes the behaviors from plan assumptions 1, 7 and 8 (hotel capacity, invalid price range, empty-state selection). | PASS |
| II. Contract-First | OpenAPI generated from backend code (springdoc); frontend uses a generated client; no hand-written API types. The error shape is part of the OpenAPI document too. | PASS |
| III. Test Every Acceptance Criterion | [Test coverage map](#test-coverage-map) maps every acceptance scenario and edge case to at least one automated test. | PASS |
| IV. Simplicity | One Spring Boot application, no broker, no microservices, no cache, no ORM. | PASS |
| V. AI Code Contract | Every new dependency is listed for approval below; assumptions are stated above. The dependency table was approved by the project owner. | PASS |

Post-design re-check (after Phase 1): unchanged, still PASS. No Complexity Tracking entries are needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-hotel-search/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── search-api.openapi.yaml   # Design-time draft; the code-generated document replaces it as the source of truth
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
infra/
└── docker-compose.yml                  # PostgreSQL 16 only

apps/
├── api/                                # Java 21, Spring Boot, Gradle (Kotlin DSL, wrapper committed)
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   ├── openapi/
│   │   └── openapi.json                # Committed snapshot of the generated OpenAPI document
│   └── src/
│       ├── main/
│       │   ├── java/com/tripdesk/api/
│       │   │   ├── TripDeskApplication.java
│       │   │   ├── config/             # Clock, search limits (max guests, page size), time zone
│       │   │   └── search/
│       │   │       ├── HotelSearchController.java
│       │   │       ├── HotelSearchService.java
│       │   │       ├── HotelSearchRepository.java     # JdbcClient keyset query
│       │   │       ├── SearchRequest.java             # parsed query params
│       │   │       ├── SearchValidator.java           # all edge-case rules
│       │   │       ├── Cursor.java                    # opaque cursor encode/decode
│       │   │       └── dto/                           # HotelResult, SearchResponse
│       │   └── resources/
│       │       ├── application.yml
│       │       └── db/migration/
│       │           ├── V1__create_search_schema.sql
│       │           └── V2__seed_sample_data.sql
│       └── test/java/com/tripdesk/api/
│           ├── support/                # Testcontainers base class, fixed clock, fixture loader
│           ├── search/                 # validator unit tests, search integration tests
│           └── contract/               # OpenAPI snapshot test
└── web/                                # Next.js App Router + TypeScript, pnpm
    ├── package.json
    ├── next.config.ts                  # rewrites /api/* to the API (browser calls, no CORS)
    ├── playwright.config.ts
    ├── vitest.config.ts
    ├── public/images/hotels/           # Static sample hotel images
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   └── search/page.tsx         # Server Component
        ├── components/
        │   ├── KeyedBySearchParams.tsx # Client (reads useSearchParams in Suspense; keys its children by the serialized search params)
        │   ├── SearchForm.tsx          # Client
        │   ├── FilterBar.tsx           # Client (filters + sort, writes URL params)
        │   ├── ResultsList.tsx         # Server
        │   ├── LoadMore.tsx            # Client
        │   ├── HotelCard.tsx
        │   └── states/                 # ErrorMessage, NoCity, NoAvailability, NoFilterMatch, LoadingResults
        ├── lib/
        │   ├── api/
        │   │   ├── generated/          # Generated client/types (committed; never hand-edited)
        │   │   └── client.ts           # base URL selection (server vs browser)
        │   ├── search-params.ts        # URL params <-> criteria/filters/sort
        │   └── error-messages.ts       # API error code -> user-facing message
        └── tests/
            ├── unit/                   # Vitest
            └── e2e/                    # Playwright
```

**Structure Decision**: Monorepo with two independent apps under `apps/` and local infrastructure under `infra/`, as requested. No root-level JavaScript workspace is created because there is a single JavaScript package; one can be added when a second appears. The Gradle build is also a single project for the same reason.

## Design Decisions

### Frontend

- `search/page.tsx` is a Server Component. It parses `searchParams` into criteria, filters and sort (`lib/search-params.ts`), and when any search criterion is present it calls the search endpoint with the generated client (`cache: 'no-store'`, so there is no hidden caching) and renders the first page.
- With no search params at all, only the empty form is shown and no API call is made.
- Under Cache Components (see the decision below) the `searchParams` read and the API call happen inside a `<Suspense>` boundary; this refines the first bullet above.
- URL params: `city`, `checkIn`, `checkOut`, `guests`, `minPrice`, `maxPrice`, `minStars`, `sort`. `SearchForm` and `FilterBar` (Client Components) update the URL; the server re-renders. Because state is in the URL, search is shareable, refreshable and back-button friendly.
- `LoadMore` (Client) receives the first page's `nextCursor`, calls the API from the browser through the same-origin `/api` rewrite, and appends items in local state. It is keyed by the search params, so any change to criteria, filters or sort resets it.
- Error handling: an error response maps by `code` through `error-messages.ts` to the exact messages in the spec. Guest-range messages read the allowed range from the error's `meta`, so the limit lives only on the server.
- Client-side checks are limited to cheap, time-zone-independent ones (required fields, check-out after check-in) for fast feedback. The server remains the single authority for every rule, including past dates and guest range.

#### Cache Components decision

Decided by the project owner: keep `cacheComponents: true` and `partialPrefetching: true` in `apps/web/next.config.ts` (both were in the `create-next-app` scaffold; `partialPrefetching` requires `cacheComponents`). Behavior is taken from the Next.js docs shipped with the installed version (`node_modules/next/dist/docs`). Consequences for this plan:

- **Still no caching.** Cache Components caches nothing unless code uses `use cache`; this feature never does, and server fetches keep `cache: 'no-store'`. `partialPrefetching` only prefetches the static App Shell of a route, and URL-specific content (including `searchParams`) resolves after navigation.
- **Suspense and the loading placeholder (FR-016).** `search/page.tsx` renders the page shell (heading and search form) without reading `searchParams`. It passes the `searchParams` promise to the results component and awaits it only inside `<Suspense fallback={<LoadingResults />}>`. The fallback is the loading placeholder required by FR-016. `SearchForm` and `FilterBar` sit in the page shell inside the `KeyedBySearchParams` wrapper (below), which reads `useSearchParams()` inside its own `<Suspense>`, because the docs require a boundary for that hook. `FilterBar` stays outside the results `<Suspense>`, so it remains visible while results load; `NoFilterMatch` and `LoadMore` render inside `ResultsList`, inside the results boundary.
- **Verified in T038 (2026-10-30).** `pnpm build` lists `/search` as partially prerendered (`◐`) and `pnpm dev` raised no blocking-route error once the results component awaits `connection()` before the API call (without it `next dev` logged a `blocking-prerender-current-time` error for the route). The fallback did NOT appear again when only the search params changed on a client navigation (the previous results stayed on screen until the new ones arrived), so the results `<Suspense>` boundary is wrapped in `KeyedBySearchParams` (with `<LoadingResults />` as its fallback), which keys it on the serialized search params. After that change the placeholder appeared on each of three consecutive searches that differed only in the search params. Checked in the browser against a delayed mock API, not against the seeded database.
- **State reset despite `<Activity>`.** Next.js keeps up to 3 visited routes mounted but hidden (`<Activity>`) and preserves Client Component state, so local state would otherwise survive a change of search params. `router.bfcacheId` does not change on search-param-only navigations, so it is NOT used. `SearchForm` and `FilterBar` read their values from the URL and are rendered inside the `KeyedBySearchParams` wrapper: a small Client Component that calls `useSearchParams()` inside `<Suspense>` (fallback `null` by default) and renders its children under a `key` equal to the serialized search params, so any change of criteria, filters or sort remounts them. `LoadMore` is keyed the same way by `ResultsList`, which already has the awaited params. Back and forward navigation restores the earlier URL and therefore its state. Checked against the docs (`useSearchParams`, `cacheComponents`, Preserving UI state): they require a `<Suspense>` boundary around `useSearchParams` and suggest deriving a key from your data in preference to `bfcacheId`; they do not contradict this approach.
- **Timing checks.** With streaming, the shell and the placeholder appear before the results. The SC-001 and SC-002 assertions in the end-to-end tests measure until the hotel list itself is visible, not until the shell or the placeholder.

### API

- Endpoint: `GET /api/v1/hotels/search` with query params `city`, `checkIn`, `checkOut`, `guests`, `minPrice`, `maxPrice`, `minStars`, `sort`, `cursor`. Page size is fixed at 20 and is not a parameter.
- Success response: `{ items: [{ id, name, starRating, pricePerNightCents, currency, imageUrl }], nextCursor }`. `nextCursor` is `null` on the last page.
- Error response: `application/problem+json` (Spring `ProblemDetail`) with `code` and an `errors` array of `{ field, code, meta }`, so several violations are reported in one response. Codes: `REQUIRED` (missing or blank), `INVALID_VALUE` (wrong format, for example an impossible date or a non-numeric number), `INVALID_DATE_RANGE`, `CHECK_IN_IN_PAST`, `GUESTS_OUT_OF_RANGE`, `INVALID_PRICE_RANGE`, `INVALID_STARS`, `INVALID_SORT`, `INVALID_CURSOR`, `CITY_NOT_FOUND`. Validation failures return HTTP 400; `CITY_NOT_FOUND` returns 404. No search query runs when validation fails. The top-level `code` repeats the `code` of the first entry in `errors`; there is no separate aggregate code. A `guests` value that is a well-formed integer beyond the 32-bit integer range (for example `99999999999`) returns `GUESTS_OUT_OF_RANGE`, not `INVALID_VALUE`. A date with a year outside 1 to 9999 returns `INVALID_VALUE`, because the database cannot hold it. A blank `cursor` is treated as absent (the first page).
- Keyset pagination: ordered by the chosen sort column then hotel id. The opaque cursor holds the last row's sort value, its id and the sort it belongs to; a cursor used with a different sort is rejected as `INVALID_CURSOR`.
- Full detail in [contracts/search-api.openapi.yaml](contracts/search-api.openapi.yaml).

### Data

- Tables: `city`, `hotel`, `hotel_unavailability` (see [data-model.md](data-model.md)).
- A hotel is returned when its city matches, `max_guests >= guests`, and no `hotel_unavailability` row overlaps the stay `[checkIn, checkOut)`.
- Indexes: unique on lower-cased city name; `hotel (city_id, price_per_night_cents, id)` for price sort and cursor; `hotel (city_id, star_rating, id)` for star sort and cursor; `hotel_unavailability (hotel_id, start_date, end_date)` for the availability check.
- At about 250 rows the planner may still choose sequential scans; the indexes establish the correct access pattern for later growth and are verified with `EXPLAIN` during implementation (quickstart step).
- Seed: V2 inserts 5 cities and about 50 deterministic hotels per city (no random values) with a spread of stars, prices and `max_guests` capacities (1 to 10, so the guest filter visibly changes results, and every city has hotels that fit 10 guests), and unavailable ranges for a share of hotels. One city has every hotel unavailable in a fixed far-future window, which gives a stable "no availability" case for end-to-end tests.

### Contract

- springdoc generates the OpenAPI document from controller and DTO code. A snapshot test fetches the document from the running (Testcontainers-backed) application and compares it with the committed `apps/api/openapi/openapi.json`; the test fails if they differ, and a documented Gradle task refreshes the snapshot.
- The frontend client is generated from that snapshot with a `pnpm` script. Generated output is committed and never edited by hand. The generator is `openapi-typescript` with `openapi-fetch` ([research.md](research.md) R1).

### Testing

- Backend integration tests use a real PostgreSQL (Testcontainers) with the Flyway schema. Tests clear the seed tables and insert their own fixtures with a fixed clock, so they do not depend on the sample data aging.
- Frontend component tests cover every error/empty-state message, filter/sort URL updates and load-more appending, with the generated client mocked at the module boundary.
- One Playwright test runs the full flow against the real API and seeded database: search, see results, filter, sort, load more.

#### Test coverage map

| Spec item | Backend integration | Vitest | Playwright |
|-----------|:---:|:---:|:---:|
| US1-AS1 results with name, stars, price, image | ✓ | ✓ (HotelCard) | ✓ |
| US1-AS2 new search replaces results | | ✓ | ✓ |
| US1-AS3 no login needed | ✓ (no credentials sent) | | ✓ |
| US1-AS4 / FR-013 hotels that cannot fit the guests are excluded | ✓ (capacity equal to, below and above `guests`) | | ✓ |
| US2-AS1 price range filter | ✓ | ✓ (URL update) | ✓ |
| US2-AS2 star filter | ✓ | ✓ (URL update) | |
| US2-AS3 sort by price / stars | ✓ | ✓ (URL update) | ✓ |
| US2-AS4 load more keeps filters and sort | ✓ (cursor continuity) | ✓ (append) | ✓ |
| US2-AS5 new search resets filters and sort | | ✓ | |
| EC check-out on or before check-in | ✓ | ✓ (message) | |
| EC check-in in the past | ✓ (fixed clock) | ✓ (message) | |
| EC guests out of range (below 1, above max) | ✓ | ✓ (message shows range) | |
| EC city not found | ✓ | ✓ (message) | |
| EC no hotels for city and dates | ✓ (overlap, boundary-day cases) | ✓ (empty state, shown when no filter is active) | ✓ (blackout city) |
| EC filters remove all results | ✓ | ✓ (empty state with clear filters, shown when a filter is active) | |
| EC required field empty | ✓ | ✓ | |
| FR-015 / EC value in the wrong format | ✓ | ✓ (message names the field) | |
| FR-014 / EC minimum price above maximum price | ✓ | ✓ | |
| FR-016 loading placeholder while results load | | ✓ (LoadingResults component; LoadMore "Loading…" button) | ✓ (placeholder observed during a search and during a filter or sort change) |
| SC-001 / SC-002 timing | measured per quickstart | | sanity assertion (under 2 s, until the hotel list is visible) |
| SC-003 invalid inputs blocked | ✓ (no query executed) | ✓ | |

## Dependencies for Approval

**Approved by the project owner**: every dependency in the tables below, including the client generator. No dependency outside these tables may be added without a plan change and approval.

### apps/api (Gradle)

| Dependency | Purpose | Notes |
|------------|---------|-------|
| `org.springframework.boot` plugin + `io.spring.dependency-management` plugin | Build, version management | Spring Boot 3.x on Java 21 |
| `spring-boot-starter-web` | REST endpoint | |
| `spring-boot-starter-validation` | Bean validation for parameter parsing | Business rules live in `SearchValidator` |
| `spring-boot-starter-jdbc` | `JdbcClient` for explicit keyset SQL | Chosen over JPA, see research R5 |
| `org.postgresql:postgresql` | JDBC driver | runtime |
| `org.flywaydb:flyway-core` + `flyway-database-postgresql` | Migrations | |
| `org.springdoc:springdoc-openapi-starter-webmvc-api` | OpenAPI from code | API document only, no Swagger UI |
| `spring-boot-starter-test` | JUnit 5, AssertJ, MockMvc | test |
| `spring-boot-testcontainers` + `org.testcontainers:junit-jupiter` + `org.testcontainers:postgresql` | Real PostgreSQL in tests | test; requires Docker |

### apps/web (pnpm)

| Dependency | Purpose | Notes |
|------------|---------|-------|
| `next`, `react`, `react-dom` | Framework | App Router |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | Types | dev; `@types/node` is `^22` (vitest 5 needs `^22.0.0 \|\| >=24.0.0`; the app's `engines` is Node >=22.12) |
| `eslint`, `eslint-config-next` | Linting | dev |
| `vitest`, `@vitejs/plugin-react`, `jsdom` | Component test runner | dev |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | Component testing | dev |
| `@playwright/test` | End-to-end test | dev; browser binaries are downloaded on first run |
| `openapi-typescript` (dev) + `openapi-fetch` (runtime) | Generated TypeScript types and typed fetch client | Decided, see research R1 |

Not added on purpose: Tailwind or any UI library (styling uses built-in CSS Modules), a data-fetching library, a form library, a date library, Redis or any cache, an ORM.

### infra

`postgres:16-alpine` container image (local only).

## Complexity Tracking

No constitution violations; no entries.
