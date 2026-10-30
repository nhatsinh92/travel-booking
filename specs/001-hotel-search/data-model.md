# Data Model: Hotel Search

**Date**: 2026-10-29 | **Source**: [spec.md](spec.md) Key Entities and Clarifications

## Entities

### City

A searchable city.

| Field | Type | Rules |
|-------|------|-------|
| `id` | bigint, primary key | generated |
| `name` | text, not null | unique case-insensitively (index on `lower(name)`); matched trimmed and case-insensitively |

### Hotel

A lodging in one city. Read-only in this feature.

| Field | Type | Rules |
|-------|------|-------|
| `id` | bigint, primary key | generated; final tie-breaker for ordering |
| `city_id` | bigint, not null | references `city(id)` |
| `name` | text, not null | |
| `star_rating` | smallint, not null | check 1 to 5 |
| `price_per_night_cents` | integer, not null | check greater than 0; single currency (USD) |
| `max_guests` | smallint, not null | check at least 1; largest party the hotel accommodates; a hotel is returned only when `max_guests >= guests` |
| `image_path` | text, not null | relative path to a static image served by the web app |

Relationships: a city has many hotels; a hotel has zero or more unavailability ranges.

### HotelUnavailability

A period during which a hotel cannot be booked (spec Clarifications, FR-007).

| Field | Type | Rules |
|-------|------|-------|
| `id` | bigint, primary key | generated |
| `hotel_id` | bigint, not null | references `hotel(id)` |
| `start_date` | date, not null | first unavailable night |
| `end_date` | date, not null | exclusive end; check `end_date > start_date` |

A stay `[checkIn, checkOut)` conflicts when `start_date < checkOut AND end_date > checkIn`. Ranges for one hotel may overlap each other; this does not change the result.

## Indexes

| Index | Serves |
|-------|--------|
| unique `city (lower(name))` | city lookup, FR-006 |
| `hotel (city_id, price_per_night_cents, id)` | default and price sorts, price-range filter, keyset cursor |
| `hotel (city_id, star_rating, id)` | star sorts, minimum-star filter, keyset cursor |
| `hotel_unavailability (hotel_id, start_date, end_date)` | availability `NOT EXISTS` check |

## Non-persisted concepts (request/response only)

| Concept | Fields | Notes |
|---------|--------|-------|
| Search criteria | `city`, `checkIn`, `checkOut`, `guests` | All required (FR-012). `guests` is validated (1 to 10) and also filters results: only hotels with `max_guests >= guests` are returned (FR-013). |
| Result refinements | `minPrice`, `maxPrice` (cents), `minStars` (1 to 5), `sort` | Optional. `sort` is one of `price_asc` (default), `price_desc`, `stars_desc`, `stars_asc`. |
| Cursor | sort name, last row's sort value, hotel id | Opaque to clients; the server encodes it as base64url of `<sort>:<value>:<id>` (`<value>` is the price in cents for the price sorts and the star rating for the star sorts). Invalid or mismatched cursor gives `INVALID_CURSOR`. A cursor is valid only with unchanged criteria, filters and sort; the server checks only the sort, so the result is undefined if criteria or filters changed. |

## Validation rules (applied on the server; mapped to spec items)

| Rule | Error code | HTTP | Spec |
|------|-----------|------|------|
| `city`, `checkIn`, `checkOut` or `guests` missing or blank | `REQUIRED` | 400 | FR-012 |
| any supplied value in the wrong format (impossible or unparseable date, non-numeric `guests`, `minPrice`, `maxPrice` or `minStars`); the error names the field. A date with a year outside 1 to 9999 is also `INVALID_VALUE` | `INVALID_VALUE` | 400 | FR-015 |
| `checkOut` on or before `checkIn` | `INVALID_DATE_RANGE` | 400 | FR-003 |
| `checkIn` before today (server clock, configured zone) | `CHECK_IN_IN_PAST` | 400 | FR-004 |
| `guests` below 1 or above the configured maximum (10), including a well-formed integer beyond the 32-bit integer range (for example `99999999999`); `meta` carries `min` and `max` | `GUESTS_OUT_OF_RANGE` | 400 | FR-005 |
| `minPrice` greater than `maxPrice`; the error names the field `maxPrice` (equal bounds are accepted) | `INVALID_PRICE_RANGE` | 400 | FR-014 |
| `minStars` outside 1 to 5, including a well-formed integer too large for any numeric type (a non-integer `minStars` is `INVALID_VALUE`) | `INVALID_STARS` | 400 | FR-008 |
| unknown `sort` value (matching is case-sensitive: only `price_asc`, `price_desc`, `stars_desc`, `stars_asc`) | `INVALID_SORT` | 400 | FR-010 |
| malformed or mismatched `cursor` (a blank `cursor` is not an error: it is treated as absent, that is, the first page) | `INVALID_CURSOR` | 400 | FR-011 |
| trimmed city not found | `CITY_NOT_FOUND` | 404 | FR-006 |

`minPrice`, `maxPrice`, `minStars` and `sort` are optional: a missing or blank value is treated as absent (`sort` then defaults to `price_asc`). A negative `minPrice` or `maxPrice` is `INVALID_VALUE`; a price bound above the 64-bit integer range is also `INVALID_VALUE`.

There is no maximum stay length (per your constraint). All field-level violations are returned together in `errors`; the response's top-level `code` repeats the first entry's code (there is no aggregate code). `CITY_NOT_FOUND` is only evaluated when the other input is valid. No search query runs on any error.

## Sample dataset

- 5 cities: Hanoi, Ho Chi Minh City, Da Nang, Singapore, Bangkok.
- About 50 hotels per city, generated deterministically (no random values): star ratings 1 to 5 and prices spread so every filter and sort changes the result, with deliberate ties on price and on stars so tie-breaking is exercised.
- `max_guests` between 1 and 10, spread so the guest filter visibly changes results; every city has some hotels with `max_guests` of 10, so the largest valid party still gets results, and some hotels with `max_guests` of 1.
- Unavailable ranges for a share of hotels at fixed dates. Da Nang: every hotel unavailable in a fixed far-future window (the stable "no availability" case for end-to-end tests; exact dates are set in the migration and documented in [quickstart.md](quickstart.md)).
- Loaded by Flyway migration `V2__seed_sample_data.sql`.
