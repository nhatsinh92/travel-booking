# Performance baseline and query plans: Hotel Search

Recorded in Phase 5 (T055, T056). Record only: no code was changed and no caching was added.

## Query plans

**Date**: 2026-10-30 | **Database**: `postgres:16-alpine` (compose container `tripdesk-postgres`), seeded by V2 (250 hotels, 110 unavailability ranges, 5 cities).

Run with `docker exec -i tripdesk-postgres psql -U tripdesk -d tripdesk` and `EXPLAIN (ANALYZE)`. The statements are the SQL of `HotelSearchRepository.search` with the request values written in as literals (Hanoi, `guests=2`, stay 2026-11-29 to 2026-12-01, `LIMIT 21`: the page size plus one, as the repository fetches) and the city id replaced by a `lower(name)` sub-select. The application binds the values as parameters and looks the city up in a separate query, so the real plans may differ in detail.

| Search | Hotel access | Index used | Execution time |
|--------|--------------|------------|----------------|
| A. Default sort (`price_asc`) | Index Scan on `hotel_city_price_idx`, filter `max_guests >= 2` | `hotel (city_id, price_per_night_cents, id)`: yes | 0.106 ms |
| B. Stars sort (`stars_desc`) | Index Scan Backward on `hotel_city_stars_idx`, filter `max_guests >= 2` | `hotel (city_id, star_rating, id)`: yes | 0.104 ms |
| C. Filtered (`minStars=3`, `maxPrice=30000`, `stars_desc`) | Seq Scan on `hotel`, then Sort (quicksort, 28 kB) | no (see below) | 0.222 ms |

- **City lookup**: all three plans use the unique index `city_name_lower_uq` (`lower(name) = 'hanoi'`).
- **A and B** read only the first 21 rows in index order, so the sort and the `LIMIT` need no extra sort step. The availability check is an anti join against `hotel_unavailability`.
- **C** chose a sequential scan of `hotel` (250 rows, 27 of them match) and sorted the result. At about 250 rows this is acceptable and expected (plan.md, Data section); the indexes establish the access pattern for later growth.
- **Availability check** (all three): a Seq Scan on `hotel_unavailability` (110 rows, 0 match the stay) inside the anti join. `hotel_unavailability_range_idx (hotel_id, start_date, end_date)` was not used at this size; the planner prefers a sequential scan of 110 rows. Not a defect at this scale, and not verified at a larger one.
- Not covered: the keyset (cursor) condition and the remaining filter combinations were not plan-checked; scenario C in the timings below exercises the cursor query through the API.

### Plan output

<details>
<summary>A. Default sort (price_asc)</summary>

```text
 Limit  (cost=8.44..16.64 rows=21 width=60) (actual time=0.047..0.057 rows=21 loops=1)
   InitPlan 1 (returns $0)
     ->  Index Scan using city_name_lower_uq on city  (cost=0.15..8.17 rows=1 width=8) (actual time=0.015..0.016 rows=1 loops=1)
           Index Cond: (lower(name) = 'hanoi'::text)
   ->  Nested Loop Anti Join  (cost=0.27..17.85 rows=45 width=60) (actual time=0.046..0.054 rows=21 loops=1)
         Join Filter: (u.hotel_id = h.id)
         ->  Index Scan using hotel_city_price_idx on hotel h  (cost=0.27..14.52 rows=45 width=60) (actual time=0.032..0.036 rows=21 loops=1)
               Index Cond: (city_id = $0)
               Filter: (max_guests >= 2)
               Rows Removed by Filter: 3
         ->  Materialize  (cost=0.00..2.65 rows=1 width=8) (actual time=0.001..0.001 rows=0 loops=21)
               ->  Seq Scan on hotel_unavailability u  (cost=0.00..2.65 rows=1 width=8) (actual time=0.010..0.010 rows=0 loops=1)
                     Filter: ((start_date < '2026-12-01'::date) AND (end_date > '2026-11-29'::date))
                     Rows Removed by Filter: 110
 Planning Time: 1.412 ms
 Execution Time: 0.106 ms
```

</details>

<details>
<summary>B. Stars sort (stars_desc)</summary>

```text
 Limit  (cost=8.44..16.64 rows=21 width=60) (actual time=0.042..0.051 rows=21 loops=1)
   InitPlan 1 (returns $0)
     ->  Index Scan using city_name_lower_uq on city  (cost=0.15..8.17 rows=1 width=8) (actual time=0.012..0.012 rows=1 loops=1)
           Index Cond: (lower(name) = 'hanoi'::text)
   ->  Nested Loop Anti Join  (cost=0.27..17.85 rows=45 width=60) (actual time=0.041..0.049 rows=21 loops=1)
         Join Filter: (u.hotel_id = h.id)
         ->  Index Scan Backward using hotel_city_stars_idx on hotel h  (cost=0.27..14.52 rows=45 width=60) (actual time=0.028..0.032 rows=21 loops=1)
               Index Cond: (city_id = $0)
               Filter: (max_guests >= 2)
               Rows Removed by Filter: 2
         ->  Materialize  (cost=0.00..2.65 rows=1 width=8) (actual time=0.001..0.001 rows=0 loops=21)
               ->  Seq Scan on hotel_unavailability u  (cost=0.00..2.65 rows=1 width=8) (actual time=0.010..0.010 rows=0 loops=1)
                     Filter: ((start_date < '2026-12-01'::date) AND (end_date > '2026-11-29'::date))
                     Rows Removed by Filter: 110
 Planning Time: 0.701 ms
 Execution Time: 0.104 ms
```

</details>

<details>
<summary>C. Filtered (minStars 3, maxPrice 30000, stars_desc)</summary>

```text
 Limit  (cost=20.87..20.92 rows=21 width=60) (actual time=0.169..0.172 rows=21 loops=1)
   InitPlan 1 (returns $0)
     ->  Index Scan using city_name_lower_uq on city  (cost=0.15..8.17 rows=1 width=8) (actual time=0.028..0.029 rows=1 loops=1)
           Index Cond: (lower(name) = 'hanoi'::text)
   ->  Sort  (cost=12.70..12.77 rows=27 width=60) (actual time=0.168..0.170 rows=21 loops=1)
         Sort Key: h.star_rating DESC, h.id DESC
         Sort Method: quicksort  Memory: 28kB
         ->  Nested Loop Anti Join  (cost=0.00..12.06 rows=27 width=60) (actual time=0.063..0.094 rows=27 loops=1)
               Join Filter: (u.hotel_id = h.id)
               ->  Seq Scan on hotel h  (cost=0.00..9.00 rows=27 width=60) (actual time=0.050..0.076 rows=27 loops=1)
                     Filter: ((max_guests >= 2) AND (price_per_night_cents <= 30000) AND (star_rating >= 3) AND (city_id = $0))
                     Rows Removed by Filter: 223
               ->  Materialize  (cost=0.00..2.65 rows=1 width=8) (actual time=0.000..0.000 rows=0 loops=27)
                     ->  Seq Scan on hotel_unavailability u  (cost=0.00..2.65 rows=1 width=8) (actual time=0.009..0.009 rows=0 loops=1)
                           Filter: ((start_date < '2026-12-01'::date) AND (end_date > '2026-11-29'::date))
                           Rows Removed by Filter: 110
 Planning Time: 0.556 ms
 Execution Time: 0.222 ms
```

</details>
