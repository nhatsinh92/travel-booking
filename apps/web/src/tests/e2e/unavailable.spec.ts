import { spawn, type ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';

// EC10, FR-017: the search service is unavailable. Playwright cannot intercept the server-side
// fetch of the results, so this file starts a second web server of the production build
// (`pnpm build` first, as for SC-001) on its own port, with API_BASE_URL pointing at a port
// where nothing listens. The database and the API need not be running for this file.

const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DEAD_API_URL = 'http://127.0.0.1:9';

let server: ChildProcess | undefined;

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const checkIn = isoDate(30);
const checkOut = isoDate(32);

async function waitUntilServing(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE_URL}/search`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The web server did not start on port ${PORT} within 30 seconds`);
}

test.describe('search service unavailable (EC10, FR-017)', () => {
  test.beforeAll(async () => {
    server = spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)],
      { env: { ...process.env, API_BASE_URL: DEAD_API_URL }, stdio: 'ignore' },
    );
    await waitUntilServing();
  });

  test.afterAll(() => {
    server?.kill();
  });

  test('tells the user to try again, and the search form stays usable', async ({ page }) => {
    await page.goto(
      `${BASE_URL}/search?city=Hanoi&checkIn=${checkIn}&checkOut=${checkOut}&guests=2`,
    );

    // Scoped to the results: Next.js also keeps a role="alert" route announcer on every page.
    const resultsAlert = page.getByRole('region', { name: 'Search results' }).getByRole('alert');
    await expect(resultsAlert).toContainText('Please try again');
    await expect(page.getByRole('article')).toHaveCount(0);

    // The form is enabled, keeps the search, and a new search can be submitted from it.
    const city = page.getByLabel('City');
    await expect(city).toBeEnabled();
    await expect(city).toHaveValue('Hanoi');
    await city.fill('Da Nang');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(/city=Da\+Nang/);
    await expect(resultsAlert).toContainText('Please try again');
    await expect(page.getByLabel('City')).toBeEnabled();
    await expect(page.getByLabel('City')).toHaveValue('Da Nang');
  });
});
