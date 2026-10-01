import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

/**
 * End-to-end tests run against the PRODUCTION build served by the Node BFF
 * (`npm run build && npm start`) — the same artefact the Docker image runs.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && PORT=${PORT} ANTHROPIC_API_KEY= LOG_EVENTS=false npm start`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
