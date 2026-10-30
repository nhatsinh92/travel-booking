import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'src/tests/e2e',
  testMatch: '**/*.spec.ts',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  },
});
