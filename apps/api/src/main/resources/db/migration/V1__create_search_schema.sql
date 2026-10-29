-- Stub for T008 (red): structure only, no check constraints and no indexes. T009 replaces this file.
CREATE TABLE city (
    id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE hotel (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id               bigint   NOT NULL REFERENCES city (id),
    name                  text     NOT NULL,
    star_rating           smallint NOT NULL,
    price_per_night_cents integer  NOT NULL,
    max_guests            smallint NOT NULL,
    image_path            text     NOT NULL
);

CREATE TABLE hotel_unavailability (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hotel_id   bigint NOT NULL REFERENCES hotel (id),
    start_date date   NOT NULL,
    end_date   date   NOT NULL
);
