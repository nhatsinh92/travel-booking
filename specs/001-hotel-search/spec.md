# Feature Specification: Hotel Search

**Feature Branch**: `001-hotel-search`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Employees search for hotels for business trips quickly, by city and dates. P1: search by city, check-in date, check-out date and number of guests; each result shows hotel name, star rating, price per night and an image. P2: filter by price range and star rating, sort by price or star rating, load more results when the list is long. Out of scope: booking, hotel detail page, login, travel policy, AI assistant."

## Clarifications

### Session 2026-10-29

- Q: With a fixed sample dataset, how should "no hotels available for the city and dates" happen? → A: Each hotel has one or more unavailable date ranges in the sample data; a hotel is excluded if the stay overlaps one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search hotels by city and dates (Priority: P1)

An employee planning a business trip enters a city, a check-in date, a check-out date and the number of guests, and receives a list of available hotels. Each result shows the hotel name, star rating, price per night and an image.

**Why this priority**: This is the core value of the product: without search there is nothing to filter or compare. It is a complete MVP on its own.

**Independent Test**: Enter a valid city, dates and guest count, submit, and verify that a list of hotels appears with name, star rating, price per night and image on each result.

**Acceptance Scenarios**:

1. **Given** a city that exists in the hotel data, valid future dates and a valid guest count, **When** the user submits the search, **Then** a list of available hotels in that city is shown, each with name, star rating, price per night and an image.
2. **Given** a valid search was just performed, **When** the user changes the dates and searches again, **Then** the results are replaced with those for the new search.
3. **Given** the user is not signed in (no login exists), **When** they open the search, **Then** they can search without any authentication step.

---

### User Story 2 - Refine and browse results (Priority: P2)

After searching, the employee narrows the results by price range and star rating, orders them by price or star rating, and loads more results when the list is long.

**Why this priority**: Refinement makes long result lists usable, but search works without it.

**Independent Test**: With a search returning more results than one page, apply a price range and star filter, change the sort, and load more; verify the list reflects each action.

**Acceptance Scenarios**:

1. **Given** search results are shown, **When** the user sets a price range, **Then** only hotels whose price per night falls within the range are shown.
2. **Given** search results are shown, **When** the user filters by star rating, **Then** only hotels matching the selected star rating are shown.
3. **Given** search results are shown, **When** the user sorts by price or by star rating, **Then** the list is ordered accordingly.
4. **Given** more matching hotels exist than are currently displayed, **When** the user chooses to load more, **Then** additional results are appended without losing the current filters and sort.
5. **Given** filters and sort are applied, **When** the user changes the search criteria and searches again, **Then** results reflect the new search and filters and sort are reset (see Assumptions).

---

### Edge Cases

- Check-out date on or before check-in date: the search is not performed; the user sees a message that the date range is invalid.
- Check-in date in the past: the search is not performed; the user sees a message that the date must be today or later.
- Number of guests below 1 or above the allowed maximum: the search is not performed; the user sees the allowed range.
- City not found: the user sees a "no matching city" message with a prompt to check the spelling.
- No hotels available for the city and dates: the user sees an empty state suggesting different dates.
- Filters remove all results: the user sees an empty state with an option to clear filters.
- A required field (city, either date, guests) is left empty: the search is not performed and the user sees which field is missing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to search for hotels by city, check-in date, check-out date and number of guests, without logging in.
- **FR-002**: Each search result MUST show the hotel name, star rating, price per night and an image.
- **FR-003**: System MUST NOT perform a search, and MUST tell the user the date range is invalid, when check-out is on or before check-in.
- **FR-004**: System MUST NOT perform a search, and MUST tell the user the check-in date must be today or later, when check-in is in the past.
- **FR-005**: System MUST NOT perform a search, and MUST show the allowed range, when guests is below 1 or above the allowed maximum.
- **FR-006**: System MUST show a "no matching city" message prompting the user to check the spelling when the city is not found.
- **FR-007**: System MUST exclude a hotel from results when the requested stay overlaps any of its unavailable date ranges, and MUST show an empty state suggesting different dates when no hotels remain for the city and dates.
- **FR-008**: Users MUST be able to filter results by price range and by star rating.
- **FR-009**: System MUST show an empty state with an option to clear filters when filters remove all results.
- **FR-010**: Users MUST be able to sort results by price and by star rating.
- **FR-011**: Users MUST be able to load more results when the list is long, keeping current filters and sort.
- **FR-012**: System MUST require city, check-in, check-out and guests before searching and indicate any missing field.

### Key Entities

- **Hotel**: A lodging in a city. Attributes: name, city, star rating, price per night, image, unavailable date ranges (zero or more).
- **Search Criteria**: City, check-in date, check-out date, number of guests.
- **Result Refinements**: Price range, star rating filter, sort order (by price or star rating).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a typical search, users see results within 2 seconds of submitting.
- **SC-002**: Applying a filter or changing the sort updates the visible list within 2 seconds.
- **SC-003**: 100% of the invalid inputs listed in the edge cases are blocked before a search runs and show the specified message.

## Assumptions

- Hotel data comes from a fixed sample dataset; no live inventory or real-time pricing.
- No login is required to search.
- The maximum number of guests is 10 (allowed range 1–10).
- Availability is determined by each hotel's unavailable date ranges in the sample dataset; price per night is a single amount in one currency.
- The star-rating filter is a minimum star rating (e.g., "3 stars and up").
- Results are shown in a default order (lowest price first) until the user chooses a sort.
- Changing search criteria and searching again resets filters and sort.
- Each page of results shows a fixed number of hotels, with "load more" appending the next set.
- Out of scope: booking, hotel detail page, login, travel policy, AI assistant.
