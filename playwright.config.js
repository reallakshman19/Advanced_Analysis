import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chromium';
const videoMode = process.env.PLAYWRIGHT_ENABLE_VIDEO === '1' ? 'retain-on-failure' : 'off';
const serverPort = process.env.PLAYWRIGHT_SERVER_PORT || '5173';

const localChromium = 'C:\\Users\\reall\\AppData\\Local\\ms-playwright\\chromium-1181\\chrome-win\\chrome.exe';
const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const detectedExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (fs.existsSync(localChromium) ? localChromium : (fs.existsSync(chromeExe) ? chromeExe : undefined));

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
