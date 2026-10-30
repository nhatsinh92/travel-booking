package com.tripdesk.api.search;

import java.util.Arrays;
import java.util.Optional;
import java.util.function.ToLongFunction;

import com.tripdesk.api.search.dto.HotelResult;

/**
 * The four sorts of the search. The column names are constants of this enum and are the only values
 * ever put into the ORDER BY and keyset parts of the SQL. Hotel id is always the tie-breaker, in the
 * same direction as the sort column.
 */
public enum SortOrder {
    PRICE_ASC("price_asc", "price_per_night_cents", true, HotelResult::pricePerNightCents),
    PRICE_DESC("price_desc", "price_per_night_cents", false, HotelResult::pricePerNightCents),
    STARS_DESC("stars_desc", "star_rating", false, HotelResult::starRating),
    STARS_ASC("stars_asc", "star_rating", true, HotelResult::starRating);

    private final String wire;
    private final String column;
    private final boolean ascending;
    private final ToLongFunction<HotelResult> sortValue;

    SortOrder(String wire, String column, boolean ascending, ToLongFunction<HotelResult> sortValue) {
        this.wire = wire;
        this.column = column;
        this.ascending = ascending;
        this.sortValue = sortValue;
    }

    /** The value of the {@code sort} query parameter. */
    public String wire() {
        return wire;
    }

    public String column() {
        return column;
    }

    public boolean ascending() {
        return ascending;
    }

    /** The value of this sort's column for a hotel, as stored in a cursor. */
    public long sortValueOf(HotelResult hotel) {
        return sortValue.applyAsLong(hotel);
    }

    public static Optional<SortOrder> fromWire(String value) {
        return Arrays.stream(values()).filter(sort -> sort.wire.equals(value)).findFirst();
    }
}
