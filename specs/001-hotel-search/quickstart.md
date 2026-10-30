# Quickstart: Hotel Search (validation guide)

Run after implementation. Commands assume the repository root; the layout comes from [plan.md](plan.md). Request and response shapes are in [contracts/search-api.openapi.yaml](contracts/search-api.openapi.yaml); data and seed in [data-model.md](data-model.md).

## Prerequisites

- Docker (database and backend tests), Java 21, Node.js LTS, pnpm.

Shell note: commands are shown for bash (Git Bash). On Windows PowerShell use `Invoke-RestMethod` (or `curl.exe`, because `curl` is an alias for `Invoke-WebRequest` there); PowerShell variants are given where they differ.

## 1. Start the database

```bash
docker compose -f infra/docker-compose.yml up -d
```

Expected: a PostgreSQL 16 container becomes healthy.

## 2. Start the API (migrations and seed run on start)

```bash
cd apps/api && ./gradlew bootRun
```

Expected: Flyway applies V1 (schema) and V2 (seed); the API listens on its configured port.

## 3. Check the API directly

Valid search (dates relative to today, so the guide does not expire):

```bash
IN=$(date -d '+30 days' +%F); OUT=$(date -d '+32 days' +%F)
curl -s "http://localhost:8080/api/v1/hotels/search?city=Hanoi&checkIn=$IN&checkOut=$OUT&guests=2"
```

PowerShell:

```powershell
$in  = (Get-Date).AddDays(30).ToString('yyyy-MM-dd')
$out = (Get-Date).AddDays(32).ToString('yyyy-MM-dd')
Invoke-RestMethod "http://localhost:8080/api/v1/hotels/search?city=Hanoi&checkIn=$in&checkOut=$out&guests=2"
```

Expected: 20 items sorted by price ascending, each with `name`, `starRating`, `pricePerNightCents`, `imageUrl`, and a non-null `nextCursor` (about 50 hotels in the city).

Invalid inputs, each expected to return the stated HTTP status with `application/problem+json` and the stated code, with no search performed:

| Change to the valid request | Status | Code |
|-----------------------------|--------|------|
| `checkOut` equal to or before `checkIn` | 400 | `INVALID_DATE_RANGE` |
| `checkIn` in the past | 400 | `CHECK_IN_IN_PAST` |
| `guests=0` or `guests=11` | 400 | `GUESTS_OUT_OF_RANGE` (meta `min` 1, `max` 10) |
| omit `city` | 400 | `REQUIRED` |
| `checkIn=2027-13-45` or `guests=abc` | 400 | `INVALID_VALUE` (names the field) |
| `city=Hanio` | 404 | `CITY_NOT_FOUND` |

Guest capacity: repeating the valid search with `guests=10` returns fewer hotels than with `guests=2` (and still at least one); every returned hotel can accommodate the requested guests.

Empty results: `city=Da Nang` with a stay inside the blackout window returns `items: []` and `nextCursor: null`. The window is 2028-12-20 (inclusive) to 2029-01-01 (exclusive), set in `V2__seed_sample_data.sql`; every Da Nang hotel is unavailable then. For example `checkIn=2028-12-20&checkOut=2028-12-22` is empty, while `checkIn=2028-12-19&checkOut=2028-12-20` and `checkIn=2029-01-01&checkOut=2029-01-03` return hotels, because a stay may end on the day the window starts or begin on the day it ends.

The seed data uses fixed dates, unlike the searches above, which are relative to today. The Da Nang blackout window ends on 2029-01-01, so after January 2029 the empty-results example here, step 5's blackout check and the "no availability" end-to-end test stop working until the window in `V2__seed_sample_data.sql` is moved.

## 4. Start the web app

```bash
cd apps/web && pnpm install && pnpm dev
```

Open `http://localhost:3000/search`.

## 5. Walk through the user stories

1. **US1**: Enter Hanoi, future dates, 2 guests, submit. Expected: results with name, stars, price per night, image; the URL now carries the search.
2. Refresh, then open the URL in a new tab. Expected: the same results.
3. **US2**: Set a price range (type the prices, then click "Apply price") and a minimum star rating, then change the sort. Expected: the list and URL update; back button restores the previous state.
4. Click "load more" at the end of the list. Expected: the next 20 hotels are appended with filters and sort unchanged.
5. **Edge cases**: submit each invalid input from step 3 in the form. Expected: the exact messages in the spec. Search an unknown city, the blackout window, and a price range that matches nothing. Expected: "no matching city", "try different dates or fewer guests", and "clear filters" states.

## 6. Run the automated tests

```bash
cd apps/api && ./gradlew test      # includes the OpenAPI snapshot check
cd apps/web && pnpm test           # Vitest
cd apps/web && pnpm exec playwright install chromium   # once: downloads the browser Playwright uses
cd apps/web && pnpm test:e2e       # Playwright (needs the database, the API and the web app on http://localhost:3000 running)
```

The end-to-end tests use the web app on port 3000. The SC-001 and SC-002 timing assertions are meant for a production build (step 7). `unavailable.spec.ts` starts its own server with `next start` on port 3101, so run `pnpm build` in `apps/web` first and keep that port free; that file does not need the database or the API.

Expected: all pass. The coverage map in [plan.md](plan.md#test-coverage-map) lists which test covers which spec item.

## 7. Measure performance (SC-001, SC-002)

Use the PowerShell commands in [tasks.md](tasks.md#baseline-performance-commands-powershell) (section "Baseline performance commands (PowerShell)"). They time four scenarios (search, filters plus sort, second page, server-rendered page) with dates relative to today. Measure SC-001 on a production build (`pnpm build` then `pnpm start` in `apps/web`), not on `pnpm dev`, which compiles routes on first use and distorts the numbers and the Playwright timing assertion.

Expected: p95 is well under 2 seconds in every scenario; the Playwright test additionally asserts results are visible in the browser within 2 seconds. Record the numbers. If they are not comfortably under target, investigate (`EXPLAIN` on the search query) before considering any caching, which is a separate change.

## 8. Contract refresh (when the API changes)

Run the Gradle task to refresh `apps/api/openapi/openapi.json`, then the `pnpm` script to regenerate the client:

```bash
cd apps/api && ./gradlew refreshOpenApiSnapshot   # needs Docker (Testcontainers)
cd apps/web && pnpm gen:api
```

Expected: no diff when nothing changed; the snapshot test fails if the committed document is stale.
