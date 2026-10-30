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
});
