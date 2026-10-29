# Quickstart: Hotel Search (validation guide)

Run after implementation. Commands assume the repository root; the layout comes from [plan.md](plan.md). Request and response shapes are in [contracts/search-api.openapi.yaml](contracts/search-api.openapi.yaml); data and seed in [data-model.md](data-model.md).

## Prerequisites

- Docker (database and backend tests), Java 21, Node.js LTS, pnpm.

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

Valid search (use dates in the future):

```bash
curl -s "http://localhost:8080/api/v1/hotels/search?city=Hanoi&checkIn=2027-03-10&checkOut=2027-03-12&guests=2"
```

Expected: 20 items sorted by price ascending, each with `name`, `starRating`, `pricePerNightCents`, `imageUrl`, and a non-null `nextCursor` (about 50 hotels in the city).

Invalid inputs, each expected to return the stated HTTP status with `application/problem+json` and the stated code, with no search performed:

| Change to the valid request | Status | Code |
|-----------------------------|--------|------|
| `checkOut` equal to or before `checkIn` | 400 | `INVALID_DATE_RANGE` |
| `checkIn` in the past | 400 | `CHECK_IN_IN_PAST` |
| `guests=0` or `guests=11` | 400 | `GUESTS_OUT_OF_RANGE` (meta `min` 1, `max` 10) |
| omit `city` | 400 | `REQUIRED` |
| `city=Hanio` | 404 | `CITY_NOT_FOUND` |

Guest capacity: repeating the valid search with `guests=10` returns fewer hotels than with `guests=2` (and still at least one); every returned hotel can accommodate the requested guests.

Empty results: `city=Da Nang` with the blackout window (see the migration for exact dates) returns `items: []` and `nextCursor: null`.

## 4. Start the web app

```bash
cd apps/web && pnpm install && pnpm dev
```

Open `http://localhost:3000/search`.

## 5. Walk through the user stories

1. **US1**: Enter Hanoi, future dates, 2 guests, submit. Expected: results with name, stars, price per night, image; the URL now carries the search.
2. Refresh, then open the URL in a new tab. Expected: the same results.
3. **US2**: Set a price range and a minimum star rating, then change the sort. Expected: the list and URL update; back button restores the previous state.
4. Click "load more" at the end of the list. Expected: the next 20 hotels are appended with filters and sort unchanged.
5. **Edge cases**: submit each invalid input from step 3 in the form. Expected: the exact messages in the spec. Search an unknown city, the blackout window, and a price range that matches nothing. Expected: "no matching city", "try different dates", and "clear filters" states.

## 6. Run the automated tests

```bash
cd apps/api && ./gradlew test      # includes the OpenAPI snapshot check
cd apps/web && pnpm test           # Vitest
cd apps/web && pnpm test:e2e       # Playwright (needs the database and API running)
```

Expected: all pass. The coverage map in [plan.md](plan.md#test-coverage-map) lists which test covers which spec item.

## 7. Measure performance (SC-001, SC-002)

```bash
for i in $(seq 1 50); do curl -s -o /dev/null -w "%{time_total}\n" "http://localhost:8080/api/v1/hotels/search?city=Hanoi&checkIn=2027-03-10&checkOut=2027-03-12&guests=2"; done | sort -n | tail -3
```

Expected: the slowest requests are well under 2 seconds; the Playwright test additionally asserts results are visible in the browser within 2 seconds. Record the numbers. If they are not comfortably under target, investigate (`EXPLAIN` on the search query) before considering any caching, which is a separate change.

## 8. Contract refresh (when the API changes)

Run the documented Gradle task to refresh `apps/api/openapi/openapi.json`, then the `pnpm` script to regenerate the client. Expected: no diff when nothing changed; the snapshot test fails if the committed document is stale.
