
import { PlaywrightTestConfig } from "@playwright/test";
import * as path from 'path';

// Read from default ".env" file.
require('dotenv').config();

const SCENARIOS = {
  S1: "npm run start:single",
  S2: "npm run start:single-token-cache-session",
  S3: "npm run start:multi",
  S4: "npm run start:multi-token-cache-session",
  S5: "npm run start:multi-token-metadata-cache-session",
};

const config: PlaywrightTestConfig = {
  reporter: './test/TestReporter.ts',
  webServer: {
    command: SCENARIOS[process.env.TEST_SCENARIO?.toString() || "S1"],
    port: 3000,
    timeout: 300000,
  },
  metadata: {
    name: process.env.TEST_SCENARIO?.toString(),
  },
  testDir: path.join(__dirname, '/test'),
  use: {
    headless: true,
    trace: 'on-first-retry',
  },
  timeout: 300000,
  globalTimeout: 5400000,
  workers: process.env.CI ? 1 : undefined,
};

export default config;