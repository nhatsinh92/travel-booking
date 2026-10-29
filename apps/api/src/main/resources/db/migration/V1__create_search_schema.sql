CREATE TABLE city (
    id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL
);

CREATE UNIQUE INDEX city_name_lower_uq ON city (lower(name));

CREATE TABLE hotel (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id               bigint   NOT NULL REFERENCES city (id),
    name                  text     NOT NULL,
    star_rating           smallint NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
    price_per_night_cents integer  NOT NULL CHECK (price_per_night_cents > 0),
    max_guests            smallint NOT NULL CHECK (max_guests >= 1),
    image_path            text     NOT NULL
);

CREATE INDEX hotel_city_price_idx ON hotel (city_id, price_per_night_cents, id);
CREATE INDEX hotel_city_stars_idx ON hotel (city_id, star_rating, id);

CREATE TABLE hotel_unavailability (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hotel_id   bigint NOT NULL REFERENCES hotel (id),
    start_date date   NOT NULL,
    end_date   date   NOT NULL,
    CHECK (end_date > start_date)
);

CREATE INDEX hotel_unavailability_range_idx ON hotel_unavailability (hotel_id, start_date, end_date);
