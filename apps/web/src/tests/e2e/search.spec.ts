import { expect, test, type Page } from '@playwright/test';

// Needs the seeded database, the API and the web app running (quickstart.md).
// Dates are relative to today (check-in today + 30 days, check-out two nights later); only the
// Da Nang blackout uses the fixed window 2028-12-20 to 2029-01-01.

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const checkIn = isoDate(30);
const checkOut = isoDate(32);

async function fillAndSearch(
  page: Page,
  search: { city: string; checkIn: string; checkOut: string; guests: string },
) {
  await page.getByLabel('City').fill(search.city);
  await page.getByLabel('Check-in').fill(search.checkIn);
  await page.getByLabel('Check-out').fill(search.checkOut);
  await page.getByLabel('Guests').fill(search.guests);
  await page.getByRole('button', { name: 'Search' }).click();
}

const hotelCards = (page: Page) => page.getByRole('article');
const hotelNames = (page: Page) => hotelCards(page).getByRole('heading').allTextContents();

// Dollar prices and star ratings of the cards on screen, in list order.
async function cardPrices(page: Page): Promise<number[]> {
  const texts = await hotelCards(page)
    .locator('p')
    .filter({ hasText: /per night/ })
    .allTextContents();
  return texts.map((text) => Number(/\$([\d,]+\.\d{2})/.exec(text)?.[1].replaceAll(',', '')));
}
async function cardStars(page: Page): Promise<number[]> {
  const labels = await hotelCards(page)
    .getByRole('img', { name: /^\d stars$/ })
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  return labels.map((label) => Number(label[0]));
}
const nonDecreasing = (values: number[]) => values.every((v, i) => i === 0 || v >= values[i - 1]);
const nonIncreasing = (values: number[]) => values.every((v, i) => i === 0 || v <= values[i - 1]);

async function searchHanoi(page: Page) {
  await fillAndSearch(page, { city: 'Hanoi', checkIn, checkOut, guests: '2' });
  await expect(hotelCards(page).first()).toBeVisible();
}
// Scoped to the results: Next.js also keeps a role="alert" route announcer on every page.
const resultsAlert = (page: Page) =>
  page.getByRole('region', { name: 'Search results' }).getByRole('alert');

test.describe('hotel search', () => {
  test.beforeEach(async ({ page }) => {
    // Records whether the loading placeholder (role "status", "Loading results") ever shows. A
    // plain wait can miss it because it can be very brief.
    await page.addInitScript(() => {
      const w = window as unknown as { __loadingSeen: boolean };
      w.__loadingSeen = false;
      const isPlaceholder = (el: Element) =>
        el.getAttribute('role') === 'status' && el.textContent?.trim() === 'Loading results';
      // Looks at the nodes each mutation added, so a placeholder that is added and removed
      // before the callback runs is still recorded.
      const check = (mutations: MutationRecord[]) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (isPlaceholder(node) || [...node.querySelectorAll('[role="status"]')].some(isPlaceholder)) {
              w.__loadingSeen = true;
            }
          }
        }
      };
      new MutationObserver(check).observe(document, { subtree: true, childList: true });
    });
    await page.goto('/search');
  });

  test('shows name, stars, price and image for each hotel (US1-AS1)', async ({ page }) => {
    await fillAndSearch(page, { city: 'Hanoi', checkIn, checkOut, guests: '2' });

    const first = hotelCards(page).first();
    await expect(first).toBeVisible();
    await expect(first.getByRole('heading')).not.toBeEmpty();
    await expect(first.getByRole('img', { name: /^\d stars$/ })).toBeVisible();
    await expect(first).toContainText(/\$\d[\d,]*\.\d{2}/);
    await expect(first).toContainText(/per night/i);
    await expect(first.locator('img[alt$="exterior"]')).toBeVisible();
    await expect
      .poll(() =>
        first
          .locator('img[alt$="exterior"]')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
  });

  test('replaces the results and the URL when the search changes (US1-AS2)', async ({ page }) => {
    // The second search changes the dates and also asks for 10 guests, which the seeded
    // capacities turn into a different set of hotels, so replaced results are visible.
    await fillAndSearch(page, { city: 'Hanoi', checkIn, checkOut, guests: '1' });
    await expect(hotelCards(page).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`checkIn=${checkIn}`));
    const before = await hotelCards(page).getByRole('heading').allTextContents();

    const newCheckIn = isoDate(60);
    const newCheckOut = isoDate(63);
    await page.getByLabel('Check-in').fill(newCheckIn);
    await page.getByLabel('Check-out').fill(newCheckOut);
    await page.getByLabel('Guests').fill('10');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(new RegExp(`checkIn=${newCheckIn}&checkOut=${newCheckOut}`));
    await expect
      .poll(async () => hotelCards(page).getByRole('heading').allTextContents())
      .not.toEqual(before);
    await expect(hotelCards(page).first()).toBeVisible();
    await expect(page.getByLabel('Check-in')).toHaveValue(newCheckIn);
  });

  test('shows the same results after a refresh and in a new page (US1-AS2, FR-001)', async ({
    page,
    context,
  }) => {
    await fillAndSearch(page, { city: 'Hanoi', checkIn, checkOut, guests: '2' });
    await expect(hotelCards(page).first()).toBeVisible();
    const names = await hotelCards(page).getByRole('heading').allTextContents();
    const url = page.url();

    await page.reload();
    await expect(hotelCards(page).first()).toBeVisible();
    expect(await hotelCards(page).getByRole('heading').allTextContents()).toEqual(names);

    const other = await context.newPage();
    await other.goto(url);
    await expect(hotelCards(other).first()).toBeVisible();
    expect(await hotelCards(other).getByRole('heading').allTextContents()).toEqual(names);
    await expect(other.getByLabel('City')).toHaveValue('Hanoi');
  });

  test('shows a hint, not the loading placeholder, on a bare /search (FR-016)', async ({
    page,
  }) => {
    await expect(page.getByLabel('City')).toBeEnabled();
    await expect(page.getByText(/enter a city/i)).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    const seen = await page.evaluate(
      () => (window as unknown as { __loadingSeen: boolean }).__loadingSeen,
    );
    expect(seen, 'the "Loading results" status appeared with no search').toBe(false);
  });

  test('needs no sign-in (US1-AS3)', async ({ page }) => {
    await expect(page.getByLabel('City')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByText(/sign in|log in|login/i)).toHaveCount(0);

    await fillAndSearch(page, { city: 'Hanoi', checkIn, checkOut, guests: '2' });
    await expect(hotelCards(page).first()).toBeVisible();
    await expect(page.getByText(/sign in|log in|login/i)).toHaveCount(0);
  });

  test('says the check-in must be today or later for a past date (EC2)', async ({ page }) => {
    await fillAndSearch(page, {
      city: 'Hanoi',
      checkIn: isoDate(-7),
      checkOut: isoDate(-5),
      guests: '2',
    });

    await expect(resultsAlert(page)).toContainText(/today or later/i);
    await expect(hotelCards(page)).toHaveCount(0);
  });

  test('says there is no matching city for an unknown city (EC4)', async ({ page }) => {
    await fillAndSearch(page, { city: 'Atlantis', checkIn, checkOut, guests: '2' });

    await expect(resultsAlert(page)).toContainText(/no matching city/i);
    await expect(resultsAlert(page)).toContainText(/spelling/i);
  });

  test('names the guests field when its value is in the wrong format (EC9)', async ({ page }) => {
    await page.goto(`/search?city=Hanoi&checkIn=${checkIn}&checkOut=${checkOut}&guests=abc`);

    await expect(resultsAlert(page)).toContainText(/guests.*wrong format/i);
    await expect(hotelCards(page)).toHaveCount(0);
  });

  test('suggests different dates or fewer guests when nothing is available (EC5)', async ({
    page,
  }) => {
    await fillAndSearch(page, {
      city: 'Da Nang',
      checkIn: '2028-12-20',
      checkOut: '2028-12-22',
      guests: '2',
    });

    await expect(page.getByText(/different dates/i)).toContainText(/smaller number of guests/i);
    await expect(hotelCards(page)).toHaveCount(0);
  });

  test('shows the loading placeholder while a search loads (FR-016)', async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __loadingSeen: boolean }).__loadingSeen = false;
    });

    await fillAndSearch(page, { city: 'Hanoi', checkIn, checkOut, guests: '2' });
    await expect(hotelCards(page).first()).toBeVisible();

    const seen = await page.evaluate(
      () => (window as unknown as { __loadingSeen: boolean }).__loadingSeen,
    );
    expect(seen, 'the "Loading results" status was never observed').toBe(true);
  });

  // Run this against a production build (`pnpm build; pnpm start`). `next dev` compiles routes on
  // first use, which adds seconds that the 2-second limit does not allow for.
  test('shows the first hotel within 2 seconds of submitting (SC-001)', async ({ page }) => {
    await page.getByLabel('City').fill('Hanoi');
    await page.getByLabel('Check-in').fill(checkIn);
    await page.getByLabel('Check-out').fill(checkOut);
    await page.getByLabel('Guests').fill('2');

    const start = Date.now();
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(hotelCards(page).first()).toBeVisible({ timeout: 2000 });

    expect(Date.now() - start).toBeLessThan(2000);
  });

  test.describe('refining and browsing (US2)', () => {
    test('a price range narrows the list and the URL carries it in cents (US2-AS1)', async ({
      page,
    }) => {
      await searchHanoi(page);
      await page.getByLabel('Minimum price ($)').fill('60');
      await page.getByLabel('Maximum price ($)').fill('100');
      await page.getByLabel('Maximum price ($)').press('Enter');

      await expect(page).toHaveURL(/minPrice=6000&maxPrice=10000/);
      await expect
        .poll(async () => {
          const prices = await cardPrices(page);
          return prices.length > 0 && prices.every((price) => price >= 60 && price <= 100);
        })
        .toBe(true);
      await expect(page.getByLabel('Minimum price ($)')).toHaveValue('60');
    });

    test('a minimum star rating narrows the list (US2-AS2)', async ({ page }) => {
      await searchHanoi(page);
      await page.getByLabel('Minimum stars').selectOption('4');

      await expect(page).toHaveURL(/minStars=4/);
      await expect
        .poll(async () => {
          const stars = await cardStars(page);
          return stars.length > 0 && stars.every((value) => value >= 4);
        })
        .toBe(true);
    });

    test('sorting by price and by stars reorders the list, and Back restores the state (US2-AS3)', async ({
      page,
    }) => {
      await searchHanoi(page);
      expect(nonDecreasing(await cardPrices(page))).toBe(true);

      await page.getByLabel('Sort by').selectOption({ label: 'Price: high to low' });
      await expect(page).toHaveURL(/sort=price_desc/);
      await expect.poll(async () => nonIncreasing(await cardPrices(page))).toBe(true);
      await expect.poll(async () => (await cardPrices(page))[0]).toBeGreaterThan(100);

      await page.getByLabel('Sort by').selectOption({ label: 'Stars: high to low' });
      await expect(page).toHaveURL(/sort=stars_desc/);
      await expect.poll(async () => (await cardStars(page))[0]).toBe(5);
      expect(nonIncreasing(await cardStars(page))).toBe(true);

      await page.goBack();
      await expect(page).toHaveURL(/sort=price_desc/);
      await expect(page.getByLabel('Sort by')).toHaveValue('price_desc');
      await expect.poll(async () => nonIncreasing(await cardPrices(page))).toBe(true);
      expect((await cardPrices(page))[0]).toBeGreaterThan(100);

      await page.goBack();
      await expect(page).not.toHaveURL(/sort=/);
      await expect(page.getByLabel('Sort by')).toHaveValue('price_asc');
      await expect.poll(async () => (await cardPrices(page))[0]).toBeLessThan(50);
    });

    test('Load more appends the next hotels and keeps the filters and the sort (US2-AS4)', async ({
      page,
    }) => {
      await searchHanoi(page);
      await page.getByLabel('Minimum stars').selectOption('2');
      await page.getByLabel('Sort by').selectOption({ label: 'Price: high to low' });
      await expect(page).toHaveURL(/minStars=2/);
      await expect(page).toHaveURL(/sort=price_desc/);
      await expect.poll(async () => (await cardPrices(page)).length).toBe(20);
      await expect.poll(async () => nonIncreasing(await cardPrices(page))).toBe(true);

      await page.getByRole('button', { name: 'Load more' }).click();

      await expect.poll(async () => (await hotelNames(page)).length).toBeGreaterThan(20);
      expect((await hotelNames(page)).length).toBeLessThanOrEqual(40);
      const names = await hotelNames(page);
      expect(new Set(names).size).toBe(names.length);
      expect((await cardStars(page)).every((value) => value >= 2)).toBe(true);
      expect(nonIncreasing(await cardPrices(page))).toBe(true);
      await expect(page).toHaveURL(/minStars=2/);
    });

    test('a combination that matches nothing offers to clear the filters (EC6)', async ({
      page,
    }) => {
      await searchHanoi(page);
      await page.getByLabel('Minimum price ($)').fill('5000');
      await page.getByLabel('Minimum price ($)').press('Enter');

      await expect(page.getByText(/no hotels match these filters/i)).toBeVisible();
      await expect(hotelCards(page)).toHaveCount(0);

      await page.getByRole('button', { name: 'Clear filters' }).click();

      await expect(hotelCards(page).first()).toBeVisible();
      await expect(page).not.toHaveURL(/minPrice=/);
      await expect(page.getByLabel('Minimum price ($)')).toHaveValue('');
      await expect(page.getByText(/no hotels match these filters/i)).toHaveCount(0);
    });

    test('a minimum price above the maximum shows the price range message, and fixing it works (EC8)', async ({
      page,
    }) => {
      await searchHanoi(page);
      await page.getByLabel('Minimum price ($)').fill('100');
      await page.getByLabel('Maximum price ($)').fill('50');
      await page.getByLabel('Maximum price ($)').press('Enter');

      await expect(resultsAlert(page)).toContainText(/price range is invalid/i);
      await expect(hotelCards(page)).toHaveCount(0);
      // The filter bar sits outside the results, so the user can correct the range.
      await expect(page.getByLabel('Maximum price ($)')).toHaveValue('50');

      await page.getByLabel('Maximum price ($)').fill('200');
      await page.getByLabel('Maximum price ($)').press('Enter');

      await expect(hotelCards(page).first()).toBeVisible();
      await expect(resultsAlert(page)).toHaveCount(0);
      await expect
        .poll(async () => {
          const prices = await cardPrices(page);
          return prices.length > 0 && prices.every((price) => price >= 100 && price <= 200);
        })
        .toBe(true);
    });

    test('a new search resets the filters and the sort (US2-AS5)', async ({ page }) => {
      await searchHanoi(page);
      await page.getByLabel('Minimum stars').selectOption('4');
      await page.getByLabel('Sort by').selectOption({ label: 'Stars: low to high' });
      await expect(page).toHaveURL(/sort=stars_asc/);

      await page.getByLabel('City').fill('Bangkok');
      await page.getByRole('button', { name: 'Search' }).click();

      await expect(page).toHaveURL(/city=Bangkok/);
      await expect(page).not.toHaveURL(/minStars=|sort=/);
      await expect(page.getByLabel('Minimum stars')).toHaveValue('');
      await expect(page.getByLabel('Sort by')).toHaveValue('price_asc');
      await expect(hotelCards(page).first()).toBeVisible();
      await expect.poll(async () => nonDecreasing(await cardPrices(page))).toBe(true);
    });

    // One change per test, each from a freshly loaded search. Two changes in a row can come so
    // soon after the previous results that the placeholder is not shown again (observed: a sort
    // change right after a filter change); that is not what FR-016 asks to check.
    async function expectPlaceholderDuring(page: Page, change: () => Promise<unknown>) {
      await searchHanoi(page);
      await page.evaluate(() => {
        (window as unknown as { __loadingSeen: boolean }).__loadingSeen = false;
      });
      const before = await hotelNames(page);

      await change();
      await expect.poll(async () => JSON.stringify(await hotelNames(page))).not.toBe(
        JSON.stringify(before),
      );

      const seen = await page.evaluate(
        () => (window as unknown as { __loadingSeen: boolean }).__loadingSeen,
      );
      expect(seen, 'the "Loading results" status was never observed').toBe(true);
    }

    test('shows the loading placeholder while a filter change loads (FR-016)', async ({
      page,
    }) => {
      await expectPlaceholderDuring(page, () => page.getByLabel('Minimum stars').selectOption('4'));
    });

    test('shows the loading placeholder while a sort change loads (FR-016)', async ({ page }) => {
      await expectPlaceholderDuring(page, () =>
        page.getByLabel('Sort by').selectOption({ label: 'Price: high to low' }),
      );
    });

    // Run against a production build, like SC-001. Timing is measured until the list has changed.
    test('each filter or sort change updates the list within 2 seconds (SC-002)', async ({
      page,
    }) => {
      await searchHanoi(page);
      const changes = [
        () => page.getByLabel('Minimum stars').selectOption('4'),
        () => page.getByLabel('Sort by').selectOption({ label: 'Price: high to low' }),
        () => page.getByLabel('Minimum stars').selectOption('5'),
      ];
      for (const change of changes) {
        const before = await hotelNames(page);
        const start = Date.now();
        await change();
        await expect
          .poll(async () => JSON.stringify(await hotelNames(page)) !== JSON.stringify(before), {
            timeout: 2000,
          })
          .toBe(true);
        expect(Date.now() - start).toBeLessThan(2000);
      }
    });
  });
});
