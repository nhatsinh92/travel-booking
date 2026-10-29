-- Deterministic sample dataset: 5 cities, 50 hotels per city, no random values.
-- n is the hotel's number within its city (1..50).

INSERT INTO city (name) VALUES
    ('Hanoi'),
    ('Ho Chi Minh City'),
    ('Da Nang'),
    ('Singapore'),
    ('Bangkok');

-- stars: 10 hotels per rating; price: each of 25 price points appears twice per city (ties),
-- shifted per city; max_guests: 1 to 10 (n mod 10 = 0 gives 1, 9 gives 10); image: one of 8 placeholders.
INSERT INTO hotel (city_id, name, star_rating, price_per_night_cents, max_guests, image_path)
SELECT c.id,
       c.name || ' Hotel ' || lpad(n::text, 2, '0'),
       1 + ((n + n / 5) % 5),
       4000 + ((n * 7) % 25) * 600 + (c.id - 1) * 500,
       1 + (n % 10),
       '/images/hotels/hotel-0' || (1 + (n + c.id) % 8) || '.png'
FROM city c
CROSS JOIN generate_series(1, 50) AS n
ORDER BY c.id, n;

-- Every 4th hotel (at most 13 per city) has one short unavailable range in Dec 2026 to 2027.
INSERT INTO hotel_unavailability (hotel_id, start_date, end_date)
SELECT id,
       DATE '2026-12-01' + ((n * 13) % 300),
       DATE '2026-12-01' + ((n * 13) % 300) + (5 + n % 10)
FROM (SELECT id, (row_number() OVER (PARTITION BY city_id ORDER BY id))::int AS n FROM hotel) ranked
WHERE n % 4 = 0;

-- Da Nang: every hotel is unavailable from 2028-12-20 (inclusive) to 2029-01-01 (exclusive).
INSERT INTO hotel_unavailability (hotel_id, start_date, end_date)
SELECT h.id, DATE '2028-12-20', DATE '2029-01-01'
FROM hotel h
JOIN city c ON c.id = h.city_id
WHERE c.name = 'Da Nang';
