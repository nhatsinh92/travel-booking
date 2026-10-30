# Tasks: Hotel Search

**Input**: Design documents from `/specs/001-hotel-search/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md, spec.md. Constitution v1.1.0 applies, notably Principle III: every acceptance scenario and edge case has an automated test task naming the item it covers, and logic is tested first (tests are written and seen failing before the implementation).

**Tests**: REQUIRED by the constitution (not optional).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 (search, P1) or US2 (refine and browse, P2). Setup, Foundational and Polish tasks have no story label.
- Paths follow plan.md: `apps/api` (Java 21, Spring Boot, Gradle), `apps/web` (Next.js, TypeScript, pnpm), `infra/`.
- Web test naming: unit tests are `*.test.ts(x)` under `apps/web/src/tests/unit/`; end-to-end tests are `*.spec.ts` under `apps/web/src/tests/e2e/`.
- Dates: tests and timing scripts use dates relative to today (check-in today + 30 days, check-out two nights later). Only the Da Nang blackout uses the fixed window 2028-12-20 to 2029-01-01.

## Coverage keys (used in "Covers:" on every test task)

- **US1-AS1..AS4**: User Story 1 acceptance scenarios 1 to 4. **US2-AS1..AS5**: User Story 2 acceptance scenarios 1 to 5 (spec.md order).
- **EC1..EC9**: the spec's Edge Cases bullets in order: EC1 check-out on or before check-in; EC2 check-in in the past; EC3 guests out of range; EC4 city not found; EC5 no hotels for city and dates; EC6 filters remove all results; EC7 required field empty; EC8 minimum price above maximum price; EC9 value in the wrong format.
- **FR-xxx / SC-xxx**: spec.md requirement and success-criterion ids.

## Test-first rule for these tasks

For every task labelled "Test first (logic)": write the test, run it, and confirm it FAILS for the expected reason (not a compile, import or setup error) before starting the implementation task named in its "Then:" note.

Before running a test-first test, create the minimal stub of every class, function or module it imports (correct signatures, bodies that throw `UnsupportedOperationException` / `throw new Error('not implemented')`, or return an empty value). The test must compile or import and then FAIL on behavior. A compile or import error does not count as seeing it fail. The stub is part of the test task; the "Then:" task replaces it with the real implementation.

Presentational components are marked "tested with code" and have their test in the same task as the component (constitution Principle III).

## Prerequisites before Phase 1

- **Dependency approval**: the project owner has approved plan.md's "Dependencies for Approval" table. Per the constitution (Principle V) and CLAUDE.md, tasks T002 and T003 install only what that table lists; anything else needs a plan change and approval first.

## Decisions and assumptions (A1 decided; A2 and A3 confirmed)

- **A1. Values in the wrong format** (DECIDED): an unparseable value (for example `checkIn=2027-13-45` or `guests=abc`) returns the new error code `INVALID_VALUE` (HTTP 400) naming the field; `REQUIRED` stays for missing or blank values. Spec: edge case EC9 and FR-015.
- **A2. Seed blackout window** (CONFIRMED): Da Nang hotels are all unavailable from 2028-12-20 (inclusive) to 2029-01-01 (exclusive). plan.md leaves the exact dates to the migration.
- **A3. US1 returns a truthful `nextCursor` for the default sort only** (CONFIRMED) (price ascending), so more than 20 results are reachable on the default order; US2 generalizes the cursor to all four sorts, the filters and the "load more" UI.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo skeleton from plan.md.

- [X] T001 Create `infra/docker-compose.yml` with a `postgres:16-alpine` service (named volume, port 5432, healthcheck, database/user/password for local development only), and add ignores for `node_modules/`, `.next/`, `build/`, `.gradle/` and `.env*` (except `.env.example`) to the root `.gitignore`
- [X] T002 Initialize `apps/api`: Gradle wrapper and `build.gradle.kts` + `settings.gradle.kts` (Java 21 toolchain, Spring Boot 3.x plugin) with ONLY the dependencies in plan.md's apps/api table, and `src/main/java/com/tripdesk/api/TripDeskApplication.java`; confirm `./gradlew build` succeeds with no tests yet
- [X] T003 [P] Initialize `apps/web` with pnpm: Next.js (App Router, TypeScript, ESLint, `src/` directory, no Tailwind) with ONLY the dependencies in plan.md's apps/web table other than the test tools; confirm `pnpm build` and `pnpm lint` succeed
- [X] T004 Configure Vitest (after T003) in `apps/web/vitest.config.ts` and `apps/web/src/tests/setup.ts` (jsdom, Testing Library, jest-dom; `test.include` set to `src/tests/unit/**/*.test.{ts,tsx}` and `src/tests/e2e/**` excluded) and add the `test` script to `apps/web/package.json`; confirm `pnpm test` runs (no tests yet is acceptable)
- [X] T005 Configure Playwright (after T004) in `apps/web/playwright.config.ts` (`testDir: 'src/tests/e2e'`, `testMatch: '**/*.spec.ts'`, base URL from environment, default `http://localhost:3000`, no `webServer` because the database and API are started separately per quickstart.md) and add the `test:e2e` script to `apps/web/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration, schema, error shape, seed data and test support that every user story needs.

**CRITICAL**: No user story work can begin until this phase is complete.

### Backend foundation

- [X] T006 Add `apps/api/src/main/resources/application.yml` (datasource from environment variables with local defaults matching T001, Flyway enabled, `server.port: 8080`, springdoc API docs enabled and UI disabled) plus `config/SearchProperties.java` (`max-guests` = 10, `page-size` = 20, `time-zone` = UTC; no maximum stay length) and `config/ClockConfig.java` (injectable `Clock` bean in the configured zone) under `apps/api/src/main/java/com/tripdesk/api/config/`
- [X] T007 [P] Create test support in `apps/api/src/test/java/com/tripdesk/api/support/`: `AbstractIntegrationTest` (Testcontainers PostgreSQL, Flyway migrations applied, full Spring context, fixed `Clock` of 2026-10-29 in the configured zone overriding the real bean), and `FixtureLoader` (truncates `hotel_unavailability`, `hotel`, `city`; helper methods to insert a city, a hotel and an unavailability range)
- [X] T008 Test first (logic): `SchemaConstraintsIT` in `apps/api/src/test/java/com/tripdesk/api/support/SchemaConstraintsIT.java` asserting the database rejects: `star_rating` 0 and 6; `price_per_night_cents` 0; `max_guests` 0; an unavailability row with `end_date` equal to or before `start_date`; a duplicate city name differing only by case. Covers: data-model.md constraints (supports EC4, EC5, FR-013). Then: T009
- [X] T009 Create `apps/api/src/main/resources/db/migration/V1__create_search_schema.sql` per data-model.md, quoting its constraints verbatim: `city` (`id` bigint PK generated, `name` text not null, unique index on `lower(name)`); `hotel` (`id` bigint PK generated, `city_id` bigint not null references `city(id)`, `name` text not null, `star_rating` smallint not null check 1 to 5, `price_per_night_cents` integer not null check greater than 0, `max_guests` smallint not null check at least 1, `image_path` text not null); `hotel_unavailability` (`id` bigint PK generated, `hotel_id` bigint not null references `hotel(id)`, `start_date` date not null, `end_date` date not null, check `end_date > start_date`); indexes `hotel (city_id, price_per_night_cents, id)`, `hotel (city_id, star_rating, id)`, `hotel_unavailability (hotel_id, start_date, end_date)`; make T008 pass
- [X] T010 [P] Test first (logic): `ApiErrorShapeTest` in `apps/api/src/test/java/com/tripdesk/api/search/ApiErrorShapeTest.java` asserting an `application/problem+json` response with `title`, `status`, top-level `code` equal to the first entry's code, and an `errors` array of `{ field, code, meta }` holding all violations together; status 400 for validation codes (including `INVALID_VALUE`) and 404 for `CITY_NOT_FOUND`. Covers: EC1, EC2, EC3, EC4, EC7, EC8, EC9 (error shape), FR-003 to FR-006, SC-003. Then: T011
- [X] T011 Implement the error shape in `apps/api/src/main/java/com/tripdesk/api/error/`: `ErrorCode` enum (exactly `REQUIRED`, `INVALID_VALUE`, `INVALID_DATE_RANGE`, `CHECK_IN_IN_PAST`, `GUESTS_OUT_OF_RANGE`, `INVALID_PRICE_RANGE`, `INVALID_STARS`, `INVALID_SORT`, `INVALID_CURSOR`, `CITY_NOT_FOUND`), `FieldError` record (`field`, `code`, `meta`), `ApiValidationException`, and an `@RestControllerAdvice` producing the problem+json body (no aggregate code); make T010 pass
- [X] T012 [P] Create 8 small self-made placeholder images `apps/web/public/images/hotels/hotel-01.png` to `hotel-08.png` (no third-party assets; make them by hand in any image editor, or generate them with a throw-away Node script that uses only built-in modules and is not committed; add no dependency)
- [X] T013 [P] Test first (data): `SeedDataIT` in `apps/api/src/test/java/com/tripdesk/api/support/SeedDataIT.java`, run against the migrated database WITHOUT truncation, asserting: exactly the 5 cities Hanoi, Ho Chi Minh City, Da Nang, Singapore, Bangkok; 45 to 55 hotels per city; star ratings 1 to 5 all present; at least two hotels share a price and at least two share a star rating within a city; every city has hotels with `max_guests` 10 and with `max_guests` 1; every `image_path` is one of `/images/hotels/hotel-01.png` to `hotel-08.png`; some hotels have unavailability ranges; every Da Nang hotel has a range covering 2028-12-20 (inclusive) to 2029-01-01 (exclusive); for guests = 2 and every 2-night stay starting from 2026-10-30 to 2028-11-30, every city except Da Nang has more than 20 matching hotels (so relative-date end-to-end searches always fill a first page). `SeedDataIT` must not share a container or Spring context with the fixture-based tests: give it its own container lifecycle (for example a separate class-level Testcontainers container and `@DirtiesContext`) so no other test can truncate the seed first. Covers: sample dataset in data-model.md; supports EC5, US1-AS4. Then: T014
- [X] T014 Create `apps/api/src/main/resources/db/migration/V2__seed_sample_data.sql` generating the dataset described in data-model.md deterministically (no `random()`, for example `generate_series` with arithmetic on the row number); make T013 pass
- [X] T015 [P] Configure `apps/web/next.config.ts` to rewrite `/api/:path*` to `${API_BASE_URL}/api/:path*`, create `apps/web/.env.example` (`API_BASE_URL=http://localhost:8080`), `apps/web/src/app/layout.tsx` and a minimal `apps/web/src/app/globals.css`

**Checkpoint**: Database schema, seed, error shape, config and test support ready.

---

## Phase 3: User Story 1 - Search hotels by city and dates (Priority: P1) MVP

**Goal**: An employee enters city, dates and guests and sees available hotels with name, stars, price per night and image.

**Independent Test**: With the stack running, search Hanoi with valid future dates and 2 guests and see a list with all four fields per hotel; each invalid input from the edge cases shows its message and runs no search.

### Backend tests first (US1)

- [X] T016 [P] [US1] Test first (logic): `SearchValidatorTest` in `apps/api/src/test/java/com/tripdesk/api/search/SearchValidatorTest.java`, using the fixed clock 2026-10-29: check-out equal to and before check-in give `INVALID_DATE_RANGE`; check-in 2026-10-28 gives `CHECK_IN_IN_PAST` while 2026-10-29 is accepted; guests 0 and 11 give `GUESTS_OUT_OF_RANGE` with `meta` `min` 1 and `max` 10 while 1 and 10 are accepted; each of city, check-in, check-out, guests missing or blank gives `REQUIRED` naming the field; several violations are returned together; a very long stay is accepted (no maximum stay length). Covers: EC1, EC2, EC3, EC7, FR-003, FR-004, FR-005, FR-012, SC-003. Then: T020
- [X] T017 [P] [US1] Test first (logic): `CursorTest` in `apps/api/src/test/java/com/tripdesk/api/search/CursorTest.java`: encode then decode returns the same price value and hotel id; a malformed string raises `INVALID_CURSOR`. Covers: FR-011 (cursor basis for US2-AS4). Then: T021
- [ ] T018 [P] [US1] Test first (logic): `HotelSearchIT` in `apps/api/src/test/java/com/tripdesk/api/search/HotelSearchIT.java` using `FixtureLoader` data and the fixed clock: only hotels of the requested city (matched trimmed and case-insensitively) are returned with `name`, `starRating`, `pricePerNightCents`, `currency`, `imageUrl` (US1-AS1, FR-002); two searches with different dates return different sets (US1-AS2); the request carries no credentials and succeeds (US1-AS3, FR-001); a hotel with `max_guests` below, equal to and above the requested guests is excluded, included, included (US1-AS4, FR-013); stays that overlap an unavailable range are excluded, a stay ending the day a range starts is included, a range ending on the check-in day does not exclude (half-open `[start, end)`), a city whose every hotel is unavailable returns empty `items` and null `nextCursor` (EC5, FR-007); an unknown city returns 404 `CITY_NOT_FOUND` (EC4, FR-006); with 25 matching hotels the first page has 20 items in price-ascending order with a non-null `nextCursor`. Then: T020, T021, T022
- [ ] T019 [P] [US1] Test first (logic): `HotelSearchValidationIT` in `apps/api/src/test/java/com/tripdesk/api/search/HotelSearchValidationIT.java` over HTTP: each invalid input from EC1, EC2, EC3, EC7 returns 400 `application/problem+json` with the right code(s) and `meta`; an impossible date (for example `checkIn=2027-13-45`) or a non-numeric `guests` (for example `guests=abc`) returns 400 `INVALID_VALUE` naming that field, while a missing or blank value still returns `REQUIRED` (decision A1, EC9); an unknown city together with an invalid date returns only the date error (the city is evaluated only when the other input is valid); in every error case the search repository is never called (verify with a Mockito spy bean). Covers: EC1, EC2, EC3, EC4, EC7, EC9, FR-003 to FR-006, FR-012, FR-015, SC-003. Then: T022, T023

### Backend implementation (US1)

- [X] T020 [US1] Implement `SearchRequest.java` and `SearchValidator.java` in `apps/api/src/main/java/com/tripdesk/api/search/` using `SearchProperties` and the injected `Clock`; make T016 pass
- [ ] T021 [US1] Implement `Cursor.java` (opaque base64url of the last row's price value and hotel id) in `apps/api/src/main/java/com/tripdesk/api/search/`; make T017 pass
- [ ] T022 [US1] Implement `HotelSearchRepository.java` with `JdbcClient` in `apps/api/src/main/java/com/tripdesk/api/search/`: city lookup by trimmed `lower(name)`; the availability `NOT EXISTS` check (`start_date < :checkOut AND end_date > :checkIn`), `max_guests >= :guests`, order by `price_per_night_cents, id`, keyset predicate `(price_per_night_cents, id) > (:p, :id)` when a cursor is given, fetch page size + 1 rows to know whether `nextCursor` exists; plus DTO records `HotelResult` and `SearchResponse` in `search/dto/` (`currency` is the constant `USD`); depends on T021
- [ ] T023 [US1] Implement `HotelSearchService.java` (validate, then city lookup, then query, in that order) and `HotelSearchController.java` (`GET /api/v1/hotels/search`, parameters per contracts/search-api.openapi.yaml; unparseable values become `INVALID_VALUE` for that field and missing or blank values `REQUIRED`, per decision A1) in `apps/api/src/main/java/com/tripdesk/api/search/`; make T018 and T019 pass; depends on T020 and T022

### Contract and client generation (US1)

- [ ] T024 [P] [US1] Test first (contract): `OpenApiSnapshotTest` in `apps/api/src/test/java/com/tripdesk/api/contract/OpenApiSnapshotTest.java` fetching `/v3/api-docs` from the running test application and comparing it with `apps/api/openapi/openapi.json`; refreshing the snapshot is done only through a Gradle task (property-controlled), never silently. Covers: constitution Principle II (contract drift). Then: T025
- [ ] T025 [US1] Add the springdoc annotations needed so the generated document matches contracts/search-api.openapi.yaml (operation id `searchHotels`, parameter descriptions, `Problem` and `FieldError` schemas with the ten codes including `INVALID_VALUE`), add the `refreshOpenApiSnapshot` Gradle task, generate and commit `apps/api/openapi/openapi.json`; make T024 pass; depends on T023
- [ ] T026 [US1] In `apps/web`, install `openapi-typescript` (dev) and `openapi-fetch` (runtime) only, add the `gen:api` script generating `apps/web/src/lib/api/generated/schema.d.ts` from `apps/api/openapi/openapi.json`, and commit the generated file without editing it by hand (`client.ts` is created in T034 after its test T030); depends on T025

### Frontend tests first (US1)

- [ ] T027 [P] [US1] Test first (logic): `money.test.ts` in `apps/web/src/tests/unit/` for `formatPricePerNight(cents, currency)` (for example 12550 and USD shows $125.50) and `dollarsToCents(text)` (valid and invalid input). Covers: US1-AS1 (price per night display). Then: T031
- [ ] T028 [P] [US1] Test first (logic): `search-params.test.ts` in `apps/web/src/tests/unit/` for parsing `city`, `checkIn`, `checkOut`, `guests` from URL search params, `hasSearch` (true when any criterion param is present, false for a bare `/search`), and `buildSearchUrl(criteria)`. Covers: US1-AS2, FR-001. Then: T032
- [ ] T029 [P] [US1] Test first (logic): `error-messages.test.ts` in `apps/web/src/tests/unit/` asserting the user-facing message for `INVALID_DATE_RANGE` (date range is invalid), `CHECK_IN_IN_PAST` (date must be today or later), `GUESTS_OUT_OF_RANGE` (shows the allowed range from `meta.min` and `meta.max`), `CITY_NOT_FOUND` (no matching city; check the spelling), `REQUIRED` (names the missing field), `INVALID_VALUE` (names the field that is in the wrong format). Covers: EC1, EC2, EC3, EC4, EC7, EC9, FR-015, SC-003. Then: T033
- [ ] T030 [P] [US1] Test first (logic): `client.test.ts`, `validate-criteria.test.ts` and `load-search.test.ts` in `apps/web/src/tests/unit/`: the server-side client uses the base URL from `API_BASE_URL` and sends `cache: 'no-store'`, the browser-side client uses an empty base URL (same-origin `/api`); `validateCriteria` reports empty required fields and check-out not after check-in without calling the API (time-zone-independent checks only; past dates and guest range are left to the server); `loadSearch(params, client)` with the client mocked returns `idle` with no params, `results` for a 200 with items, `empty` for a 200 with no items and no filter active, `no-city` for 404 `CITY_NOT_FOUND`, and `error` carrying the codes (and field names) for a 400, including `INVALID_VALUE`. Covers: EC1, EC2, EC3, EC4, EC5, EC7, EC9, SC-003, and constitution Principle III (logic module `client.ts`). Then: T034
- [ ] T036a [P] [US1] Test first (logic): `KeyedBySearchParams.test.tsx` in `apps/web/src/tests/unit/` with `useSearchParams` from `next/navigation` mocked: the children render; a child's local state (for example a typed value) survives a re-render with the same search params and is discarded when the serialized search params change (the child remounts); with no params the children still render; when the mocked `useSearchParams` suspends, the `fallback` prop is shown (`null` when no fallback is given). Before running it, create the stub `apps/web/src/components/KeyedBySearchParams.tsx` (correct props, returns `null`) so the test compiles and fails on behavior. Covers: plan.md Cache Components decision (state reset despite `<Activity>`), US1-AS2, US2-AS5. Then: T036b

### Frontend implementation (US1)

- [ ] T031 [P] [US1] Implement `apps/web/src/lib/money.ts`; make T027 pass
- [ ] T032 [P] [US1] Implement `apps/web/src/lib/search-params.ts`; make T028 pass
- [ ] T033 [P] [US1] Implement `apps/web/src/lib/error-messages.ts`; make T029 pass
- [ ] T034 [US1] Implement `apps/web/src/lib/api/client.ts` (typed `openapi-fetch` client over the generated schema from T026; server base URL from `API_BASE_URL`, browser base URL empty so calls use the `/api` rewrite; `cache: 'no-store'` for server calls), `apps/web/src/lib/validate-criteria.ts` and `apps/web/src/lib/load-search.ts`; make T030 pass
- [ ] T035 [P] [US1] Create `apps/web/src/components/HotelCard.tsx` (name, stars, price per night via `formatPricePerNight`, `next/image` for the image), tested with code in `apps/web/src/tests/unit/HotelCard.test.tsx`. Covers: US1-AS1, FR-002
- [ ] T036 [P] [US1] Create the state components `apps/web/src/components/states/ErrorMessage.tsx`, `NoCity.tsx` and `NoAvailability.tsx` (suggests different dates or a smaller number of guests), and `LoadingResults.tsx` (the loading placeholder: `role="status"` with the text "Loading results"), tested with code in `apps/web/src/tests/unit/states.test.tsx`. Covers: EC1, EC2, EC3, EC4, EC5, EC7, FR-006, FR-007, FR-016
- [ ] T036b [P] [US1] Implement `apps/web/src/components/KeyedBySearchParams.tsx` (Client Component: renders `<Suspense fallback={fallback ?? null}>` around an inner component that calls `useSearchParams()` and renders its children inside `<Fragment key={searchParams.toString()}>`; `fallback` is an optional prop); make T036a pass
- [ ] T037 [US1] Create `apps/web/src/components/SearchForm.tsx` (Client Component: city, check-in, check-out, guests; client-side checks from `validateCriteria`; on valid submit pushes the criteria to the URL; its initial field values are read from the URL with `useSearchParams()`, and it is rendered inside `KeyedBySearchParams` (T036b), which remounts it when the search params change, despite `<Activity>` (plan.md, Cache Components decision)), tested with code in `apps/web/src/tests/unit/SearchForm.test.tsx`, including a reset check rendered under `KeyedBySearchParams` with `useSearchParams` mocked: changing the search params shows the new values and none of the previously typed state. Depends on T036b. Covers: US1-AS2, EC1, EC7, FR-012
- [ ] T038 [US1] Create `apps/web/src/components/ResultsList.tsx` (Server Component rendering `HotelCard`s) and `apps/web/src/app/search/page.tsx` (Server Component: the page shell, which renders `SearchForm` inside `KeyedBySearchParams`, does not read `searchParams`; the `searchParams` promise is passed down and awaited only inside `<Suspense fallback={<LoadingResults />}>`, where it is parsed, `loadSearch` is called and results or the matching state are rendered; show only the form when `hasSearch` is false). Verify, and record the outcome in plan.md's Cache Components decision: `pnpm build` and `pnpm dev` raise no blocking-route error for `/search`, and the fallback appears again when only the search params change on a client navigation; if it does not, key the `<Suspense>` boundary on the serialized search params through a small Client Component wrapper. Covers: FR-016 (together with T036 and T039); depends on T034 to T037 and T036b
- [ ] T039 [US1] Create the Playwright test `apps/web/src/tests/e2e/search.spec.ts` against the seeded database: search Hanoi with valid dates relative to today (see Format) and 2 guests and see hotels with name, stars, price and image (US1-AS1); change the dates and search again, results and URL update (US1-AS2); refresh and open the URL in a new page, same results; no sign-in step anywhere (US1-AS3); a past check-in date shows the "today or later" message (EC2); an unknown city shows the "no matching city" message (EC4); Da Nang with the blackout dates shows the "different dates or fewer guests" state (EC5); the loading placeholder (role "status", "Loading results") is shown while a search loads (FR-016; recorded with a `MutationObserver` installed by `page.addInitScript`, because the placeholder can be too brief to catch with a plain wait; if it cannot be observed reliably, report it to the project owner and do not count it as a pass); results are visible within 2 seconds (SC-001 sanity), measured from submit until the first hotel card is visible, not until the page shell or the placeholder appears (the page streams). Covers: US1-AS1, US1-AS2, US1-AS3, EC2, EC4, EC5, FR-016, SC-001

**Checkpoint**: User Story 1 is fully functional and testable on its own (MVP).

---

## Phase 4: User Story 2 - Refine and browse results (Priority: P2)

**Goal**: Filter by price range and minimum stars, sort by price or stars, and load more results.

**Independent Test**: With a search returning more than 20 hotels, apply a price range and a star filter, change the sort, and load more; the list reflects each action and filters and sort are kept while loading more.

### Backend tests first (US2)

- [ ] T040 [P] [US2] Test first (logic): extend `SearchValidatorTest` in `apps/api/src/test/java/com/tripdesk/api/search/SearchValidatorTest.java`: `minPrice` greater than `maxPrice` gives `INVALID_PRICE_RANGE` while equal is accepted; `minStars` 0 and 6 give `INVALID_STARS`; an unknown `sort` gives `INVALID_SORT`; `sort` defaults to `price_asc`. Covers: EC8, FR-014, FR-008, FR-010. Then: T044
- [ ] T041 [P] [US2] Test first (logic): `HotelSearchFilterSortIT` in `apps/api/src/test/java/com/tripdesk/api/search/HotelSearchFilterSortIT.java`: `minPrice`/`maxPrice` (inclusive bounds) keep only hotels in range (US2-AS1); `minStars` keeps hotels at or above it (US2-AS2); each of `price_asc`, `price_desc`, `stars_desc`, `stars_asc` orders correctly with ties broken by hotel id in the same direction (US2-AS3); filters that remove everything return empty `items` and null `nextCursor` (EC6, FR-009); filters combine with the capacity and availability rules; a non-numeric `minPrice`, `maxPrice` or `minStars` returns 400 `INVALID_VALUE` naming the field. Covers: US2-AS1, US2-AS2, US2-AS3, EC6, EC9, FR-008, FR-010, FR-015. Then: T044
- [ ] T042 [P] [US2] Test first (logic): `HotelSearchPagingIT` in `apps/api/src/test/java/com/tripdesk/api/search/HotelSearchPagingIT.java` with 45 fixture hotels containing ties on price and stars: following `nextCursor` yields pages of 20, 20, 5 with no duplicates and no gaps for each of the four sorts, also with filters applied; the last page has a null `nextCursor`; a cursor from one sort used with another gives 400 `INVALID_CURSOR`; a malformed cursor gives 400 `INVALID_CURSOR`. Covers: US2-AS4, FR-011. Then: T044
- [ ] T043 [P] [US2] Test first (logic): extend `CursorTest` in `apps/api/src/test/java/com/tripdesk/api/search/CursorTest.java`: the cursor encodes its sort and star-rating values, and decoding it with a different sort is rejected with `INVALID_CURSOR`. Covers: US2-AS4, FR-011. Then: T044

### Backend implementation (US2)

- [ ] T044 [US2] Extend `SearchValidator.java`, `Cursor.java` (bound to the sort name), `HotelSearchRepository.java` (dynamic `minPrice`, `maxPrice`, `minStars` predicates; the four sorts; row-value keyset predicates for `(price_per_night_cents, id)` and `(star_rating, id)` in both directions per research.md R2), `HotelSearchService.java` and `HotelSearchController.java` in `apps/api/src/main/java/com/tripdesk/api/search/` (unparseable `minPrice`, `maxPrice` or `minStars` give `INVALID_VALUE`); make T040 to T043 pass and keep T016 to T019 passing
- [ ] T045 [US2] Add the new parameters to the springdoc annotations, run `refreshOpenApiSnapshot` to update `apps/api/openapi/openapi.json`, then run `pnpm gen:api` in `apps/web` to regenerate `apps/web/src/lib/api/generated/schema.d.ts`; make `OpenApiSnapshotTest` pass; depends on T044

### Frontend tests first (US2)

- [ ] T046 [P] [US2] Test first (logic): extend `search-params.test.ts` in `apps/web/src/tests/unit/`: `minPrice`, `maxPrice`, `minStars`, `sort` parse and serialize (price entered in dollars, stored in cents via `dollarsToCents`); changing a filter or the sort keeps the search criteria; submitting new search criteria drops all filters and the sort; default sort is `price_asc`. Covers: US2-AS1, US2-AS2, US2-AS3, US2-AS5. Then: T049
- [ ] T047 [P] [US2] Test first (logic): extend `error-messages.test.ts` in `apps/web/src/tests/unit/` with `INVALID_PRICE_RANGE` (price range is invalid) and a generic fallback message for `INVALID_STARS`, `INVALID_SORT` and `INVALID_CURSOR`. Covers: EC8, FR-014. Then: T049
- [ ] T048 [P] [US2] Test first (logic): extend `load-search.test.ts` in `apps/web/src/tests/unit/`: filters and sort are passed to the client; an empty result with a filter active returns `no-filter-match`, while an empty result with no filter returns `empty`; the `nextCursor` of the first page is returned for the load-more component. Covers: EC5, EC6, FR-007, FR-009. Then: T049

### Frontend implementation (US2)

- [ ] T049 [US2] Extend `apps/web/src/lib/search-params.ts`, `apps/web/src/lib/error-messages.ts` and `apps/web/src/lib/load-search.ts`; make T046 to T048 pass and keep T027 to T030 passing
- [ ] T050 [P] [US2] Create `apps/web/src/components/FilterBar.tsx` (Client Component: price range in dollars, minimum stars, sort; each change updates the URL while keeping the search criteria; its control values are read from the URL with `useSearchParams()`, and it is rendered inside `KeyedBySearchParams` (T036b), which remounts it when the search params change, despite `<Activity>`), tested with code in `apps/web/src/tests/unit/FilterBar.test.tsx`, including a reset check rendered under `KeyedBySearchParams` with `useSearchParams` mocked: search params that carry no filters clear the price, stars and sort controls, and search params with filters show them. Depends on T036b. Covers: US2-AS1, US2-AS2, US2-AS3, US2-AS5
- [ ] T051 [P] [US2] Create `apps/web/src/components/states/NoFilterMatch.tsx` with a "Clear filters" action that removes filters and sort from the URL, tested with code in `apps/web/src/tests/unit/states.test.tsx`. Covers: EC6, FR-009
- [ ] T052 [P] [US2] Create `apps/web/src/components/LoadMore.tsx` (Client Component: receives the first page's `nextCursor` and the search params, calls the API from the browser through the `/api` rewrite with the same criteria, filters and sort, appends `HotelCard`s, hides itself when `nextCursor` is null, while a request is pending its button reads "Loading…" and is disabled, resets when the search params change by being keyed on the serialized search params, not on `router.bfcacheId`, which does not change on search-param-only navigations), tested with code in `apps/web/src/tests/unit/LoadMore.test.tsx`, including a reset check: after items are appended, re-rendering with different search params (and a new `nextCursor`) discards the appended items and uses the new cursor; and a loading check: with the API call held pending, the button reads "Loading…" and is disabled, and after it resolves the new items are appended and the button is enabled again (or hidden when `nextCursor` is null). Covers: US2-AS4, US2-AS5, FR-011, FR-016
- [ ] T053 [US2] Wire `NoFilterMatch` and `LoadMore` into `apps/web/src/components/ResultsList.tsx`, which renders inside the existing `<Suspense fallback={<LoadingResults />}>` boundary from T038, and `FilterBar` into `apps/web/src/app/search/page.tsx` next to `SearchForm` inside `KeyedBySearchParams`, outside the results boundary so it remains visible while results load; make `SearchForm` submit drop filters and sort, and update `apps/web/src/tests/unit/SearchForm.test.tsx`. Re-run the T038 build and fallback verification with the filter, sort and load-more flows. Covers: US2-AS5, FR-016; depends on T049 to T052
- [ ] T054 [US2] Extend `apps/web/src/tests/e2e/search.spec.ts` with: setting a price range and minimum stars narrows the list (US2-AS1, US2-AS2); sorting by price and by stars reorders it and the URL carries the state, back button restores the previous state (US2-AS3); "load more" appends the next 20 hotels keeping filters and sort (US2-AS4); a filter combination matching nothing shows the "clear filters" state and clearing it restores results (EC6); a new search resets filters and sort (US2-AS5); the loading placeholder is shown while a filter or sort change loads (FR-016, same observer approach and same reporting rule as T039); each filter or sort change updates the visible list within 2 seconds (SC-002 sanity), measured until the list content has actually changed (for example the first card or the card count differs from before), not until the URL changes or the placeholder appears. Covers: US2-AS1 to US2-AS5, EC6, FR-016, SC-002

**Checkpoint**: User Stories 1 and 2 both work; all spec acceptance scenarios and edge cases have passing tests.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Performance baseline, query verification and spec/plan reconciliation. No caching is added in this feature.

- [ ] T055 Verify the search query plans: with the seeded database, run `EXPLAIN (ANALYZE)` for the default-sort search, a stars-sort search and a filtered search (docker exec into the compose PostgreSQL with `psql`), and record each plan and whether the indexes from data-model.md are used in a "Query plans" section of `specs/001-hotel-search/performance-baseline.md` (create the file here if T056 has not); at about 250 rows sequential scans are acceptable, note them as such (plan.md Data section)
- [ ] T056 Record the baseline performance with NO caching, following quickstart.md step 7, using the PowerShell commands in [Baseline performance commands](#baseline-performance-commands-powershell) below, and write the results to `specs/001-hotel-search/performance-baseline.md`: date, machine (CPU, RAM, Docker), commit hash, the four scenarios (first request, p50, p95, max in milliseconds), the Playwright 2-second assertion result, and a pass/fail note against SC-001 and SC-002 (2000 ms). Record only: do not change code or add caching, even if a number misses the target; a miss becomes a separate change. Covers: SC-001, SC-002 (measurement). Depends on T054
- [ ] T057 Run the full quickstart.md validation (steps 1 to 8) on this machine; for each step that fails or is wrong, note the exact fix needed and apply it to the code, or report it, without rewriting unrelated sections of quickstart.md
- [ ] T058 Traceability check (constitution Principle III): list every acceptance scenario (US1-AS1..AS4, US2-AS1..AS5), edge case (EC1..EC9) and FR-016 with the name of at least one passing automated test that covers it, and add any missing test; update plan.md's "Test coverage map" only where it differs from what was built
- [ ] T059 Reconcile documents with the implemented behavior (constitution Principle I): update `specs/001-hotel-search/spec.md`, `plan.md`, `data-model.md` and `contracts/search-api.openapi.yaml` only where the code differs (including the `INVALID_VALUE` handling decided in A1, and the details settled in Phase 2: `meta` is always returned, as an empty object when there is no extra data, although the draft contract marks it optional; the error titles "Validation failed" and "City not found"; the `API_BASE_URL` default of `http://localhost:8080` in `next.config.ts`), and add the exact Da Nang blackout window (assumption A2) to quickstart.md step 3
- [ ] T060 [P] Run `pnpm lint` and `pnpm test` in `apps/web` and `./gradlew build` in `apps/api`; fix only lint or formatting findings in files this feature created

---

## Baseline performance commands (PowerShell)

Used by T056. Windows PowerShell 5.1 compatible (no `&&`, uses `Measure-Command`, `Invoke-RestMethod`, `Invoke-WebRequest -UseBasicParsing`).

**Preconditions (no caching)**: the database is running with the seed from V2; the API is running (`./gradlew bootRun` in `apps/api`); for scenario D the web app runs as a production build (`pnpm build; pnpm start` in `apps/web`, not `pnpm dev`); no cache layer exists in this feature and server calls use `cache: 'no-store'`. Restart the API just before measuring so "first request" reflects a fresh start. Close heavy applications and use the same machine state for later comparisons.

Record the environment:

```powershell
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors
[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
git rev-parse --short HEAD
```

Define the measuring function (first request is timed separately, then 5 warm-up calls are discarded, then 50 timed calls):

```powershell
function Measure-Endpoint {
    param([string]$Name, [string]$Url, [int]$Runs = 50, [switch]$Html)
    $call = if ($Html) { { Invoke-WebRequest -UseBasicParsing -Uri $Url | Out-Null } }
            else       { { Invoke-RestMethod -Uri $Url | Out-Null } }
    $first = (Measure-Command -Expression $call).TotalMilliseconds
    1..5 | ForEach-Object { & $call }
    $ms = 1..$Runs | ForEach-Object { (Measure-Command -Expression $call).TotalMilliseconds } | Sort-Object
    [pscustomobject]@{
        Scenario = $Name
        FirstMs  = [math]::Round($first)
        P50Ms    = [math]::Round($ms[[math]::Ceiling($Runs * 0.50) - 1])
        P95Ms    = [math]::Round($ms[[math]::Ceiling($Runs * 0.95) - 1])
        MaxMs    = [math]::Round($ms[-1])
    }
}
```

Run the four scenarios (A basic search, B filters plus stars sort, C second page through the cursor, D server-rendered search page). Adjust the price bounds in B only if the seed makes it return no hotels, and confirm each scenario returns hotels before trusting its timing:

```powershell
$api  = 'http://localhost:8080/api/v1/hotels/search'
$in   = (Get-Date).AddDays(30).ToString('yyyy-MM-dd')
$out  = (Get-Date).AddDays(32).ToString('yyyy-MM-dd')
$base = "city=Hanoi&checkIn=$in&checkOut=$out&guests=2"
$page1 = Invoke-RestMethod -Uri "$api?$base"
"A returns $($page1.items.Count) items; nextCursor present: $($null -ne $page1.nextCursor)"
$cursor = [uri]::EscapeDataString($page1.nextCursor)

$results = @(
    Measure-Endpoint 'A search, default sort'    "$api?$base"
    Measure-Endpoint 'B filters + stars sort'    "$api?$base&minStars=3&maxPrice=30000&sort=stars_desc"
    Measure-Endpoint 'C load more (page 2)'      "$api?$base&cursor=$cursor"
    Measure-Endpoint 'D web page, server render' "http://localhost:3000/search?$base" -Html
)
$results | Format-Table -AutoSize
```

Scenario D measures the server-rendered HTML including its API call; it does not include browser hydration or image loading. The end-to-end browser figure comes from the Playwright 2-second assertion (T039, T054). Copy the table into `performance-baseline.md`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: starts after the dependency approval above.
- **Foundational (Phase 2)**: depends on Phase 1; blocks all user stories.
- **User Story 1 (Phase 3)**: depends on Phase 2.
- **User Story 2 (Phase 4)**: depends on Phase 2 and on US1's search endpoint, client generation and page (T023, T026, T038): it extends them.
- **Polish (Phase 5)**: depends on both user stories.

### Within a story

- Logic tests are written and seen failing first, then the implementation named in "Then:".
- Backend before client generation (T025, T026), client generation before the frontend `loadSearch` (T034).
- Components are tested with their code; the page wiring comes last, then the end-to-end test.

### Key task dependencies

- T008 before T009; T010 before T011; T013 before T014.
- T036a before T036b; T037, T038 and T050 need T036b.
- T016 to T019 before T020 to T023; T022 needs T021; T023 needs T020 and T022; T025 needs T023; T026 needs T025.
- T044 needs T040 to T043; T045 needs T044; T049 needs T046 to T048; T053 needs T049 to T052; T054 needs T053.
- T056 needs T054; T058 and T059 come after all other implementation tasks.

## Parallel opportunities

- Setup: T003 (`apps/web`) can run in parallel with T002 (`apps/api`). T004 and T005 edit the same `apps/web/package.json` and lockfile as T003, so they run after T003 and in order (T003, T004, T005).
- Foundational: T007, T010, T012, T013, T015 can start together.
- US1 backend tests T016 to T019 and T024 together; frontend tests T027 to T030 together; implementations T031, T032, T033 together; components T035 and T036 together.
- US2 backend tests T040 to T043 together; frontend tests T046 to T048 together; components T050 to T052 together.
- US1 frontend tests and implementation (T027 to T039) can proceed in parallel with US2 backend tests (T040 to T043) once T026 exists, if two people or agents work in separate directories.

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 and Phase 2.
2. Phase 3 (US1), then STOP and validate with the quickstart steps for US1 and the Playwright US1 tests.

### Incremental delivery

1. Add US2 (Phase 4); re-run all tests.
2. Phase 5: query plans, baseline performance, quickstart validation, traceability, document reconciliation.

## Notes

- Commit after each task or logical group; see CLAUDE.md for the working rules (no new dependencies without approval, report every change).
- Every test task names the spec items it covers; Phase 5 T058 verifies none is left without a test.
- Not included on purpose: caching, authentication, deployment, booking, hotel detail page.
