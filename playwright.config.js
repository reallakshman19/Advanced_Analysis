import { defineConfig, devices } from '@playwright/test';

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chromium';
const videoMode = process.env.PLAYWRIGHT_ENABLE_VIDEO === '1' ? 'retain-on-failure' : 'off';
const serverPort = process.env.PLAYWRIGHT_SERVER_PORT || '5173';

// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH when the pinned Playwright build does
// not match the browser actually installed, which is the usual case on a
// sandbox where `playwright install` cannot run. Left unset, Playwright
// resolves the browser itself from `channel`.
const detectedExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://127.0.0.1:${serverPort}`,
    navigationTimeout: 60000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: videoMode,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: detectedExecutable ? undefined : browserChannel,
        executablePath: detectedExecutable,
        launchOptions: {
          executablePath: detectedExecutable,
        },
      },
    },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${serverPort} --base /`,
    url: `http://127.0.0.1:${serverPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
