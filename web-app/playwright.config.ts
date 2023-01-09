
import { PlaywrightTestConfig } from "@playwright/test";
import * as path from 'path';

require('dotenv').config();

const SCENARIOS = {
  s1: "auth-code-single-no-cache",
  s2: "auth-code-single-token-cache-session",
  s3: "auth-code-multi-token-cache-session",
  s4: "auth-code-multi-token-metadata-cache-session",
}

const config: PlaywrightTestConfig = {
  reporter: './test/TestReporter.ts',
  webServer: {
    command: `npm run start:${SCENARIOS[process.env.TEST_SCENARIO || "s1"]}`,
    port: 3000,
  },
  metadata: {
    name: SCENARIOS[process.env.TEST_SCENARIO || "s1"],
  },
  testDir: path.join(__dirname, '/test'),
  use: {
    headless: true,
    trace: 'on-first-retry',
  },
  timeout: 300000,
  workers: process.env.CI ? 1 : undefined,
};

export default config;