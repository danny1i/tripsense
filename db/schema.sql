-- TripSense — PostgreSQL data model (production design).
-- The prototype serves the same shape from in-memory demo data
-- (src/data). This schema shows how it would be stored in RDS.

CREATE TABLE destination (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  country                  TEXT NOT NULL,
  region                   TEXT NOT NULL,
  has_beach                BOOLEAN NOT NULL,
  flight_hours_from_london NUMERIC(3, 1) NOT NULL,
  summary                  TEXT NOT NULL
);

-- One row per destination per month (1–12): supports "warm in November".
CREATE TABLE destination_climate (
  destination_id TEXT NOT NULL REFERENCES destination (id) ON DELETE CASCADE,
  month          SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  avg_high_c     SMALLINT NOT NULL,
  PRIMARY KEY (destination_id, month)
);

CREATE TABLE destination_activity (
  destination_id TEXT NOT NULL REFERENCES destination (id) ON DELETE CASCADE,
  position       SMALLINT NOT NULL,
  name           TEXT NOT NULL,
  PRIMARY KEY (destination_id, position)
);

CREATE TABLE hotel (
  id               TEXT PRIMARY KEY,
  destination_id   TEXT NOT NULL REFERENCES destination (id),
  name             TEXT NOT NULL,
  rating           NUMERIC(2, 1) NOT NULL CHECK (rating BETWEEN 0 AND 5),
  beach_distance_m INTEGER CHECK (beach_distance_m >= 0), -- NULL = no beach nearby
  nightlife_score  SMALLINT NOT NULL CHECK (nightlife_score BETWEEN 1 AND 5),
  family_friendly  BOOLEAN NOT NULL,
  couple_friendly  BOOLEAN NOT NULL,
  amenities        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TYPE board_basis AS ENUM ('Room only', 'Bed & breakfast', 'Half board', 'All inclusive');

CREATE TABLE package (
  id                TEXT PRIMARY KEY,
  hotel_id          TEXT NOT NULL REFERENCES hotel (id),
  price_pp_pence    INTEGER NOT NULL CHECK (price_pp_pence > 0), -- money as integer minor units
  currency          CHAR(3) NOT NULL DEFAULT 'GBP',
  nights            SMALLINT NOT NULL CHECK (nights > 0),
  board_basis       board_basis NOT NULL,
  departure_airport TEXT NOT NULL,
  description       TEXT NOT NULL,
  holiday_types     TEXT[] NOT NULL DEFAULT '{}',
  available_months  SMALLINT[] NOT NULL -- 1–12
);

-- Indexes chosen for the main search access patterns.
CREATE INDEX idx_hotel_destination       ON hotel (destination_id);
CREATE INDEX idx_package_hotel           ON package (hotel_id);
CREATE INDEX idx_package_price           ON package (price_pp_pence);
CREATE INDEX idx_package_nights          ON package (nights);
CREATE INDEX idx_package_months          ON package USING GIN (available_months);
CREATE INDEX idx_package_holiday_types   ON package USING GIN (holiday_types);
CREATE INDEX idx_climate_month_temp      ON destination_climate (month, avg_high_c);

-- Example: warm (20°C+) beach packages in November under £400 within 1 km of a beach.
-- SELECT p.id, d.name, h.name, p.price_pp_pence / 100.0 AS price
-- FROM package p
-- JOIN hotel h ON h.id = p.hotel_id
-- JOIN destination d ON d.id = h.destination_id
-- JOIN destination_climate c ON c.destination_id = d.id AND c.month = 11
-- WHERE c.avg_high_c >= 20
--   AND 11 = ANY (p.available_months)
--   AND p.price_pp_pence <= 40000
--   AND h.beach_distance_m <= 1000
-- ORDER BY p.price_pp_pence;
