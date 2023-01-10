
import { PlaywrightTestConfig } from "@playwright/test";
import * as path from 'path';

require('dotenv').config();

const SCENARIOS = {
    s1: {
        command: "npm start -- --im=single --cm=none --cs=30000 --mc=false --sn=auth-code-single-no-cache --out=./reports/measurements.txt",
        name: "auth-code-single-no-cache"
    },
    s2: {
        command: "npm start -- --im=single --cm=session --cs=30000 --mc=false --sn=auth-code-single-token-cache-session --out=./reports/measurements.txt",
        name: "auth-code-single-token-cache-session"
    },
    s3: {
        command: "npm start -- --im=multi --cm=session --cs=30000 --mc=false --sn=auth-code-multi-token-cache-session --out=./reports/measurements.txt",
        name: "auth-code-multi-token-cache-session"
    },
    s4: {
        command: "npm start -- --im=multi --cm=session --cs=30000 --mc=true --sn=auth-code-multi-token-metadata-cache-session --out=./reports/measurements.txt",
        name: "auth-code-multi-token-metadata-cache-session"
    },
};

const config: PlaywrightTestConfig = {
    reporter: './test/TestReporter.ts',
    webServer: {
        command: `${SCENARIOS[process.env.TEST_SCENARIO || "s1"].command}`,
        port: 3000,
    },
    metadata: {
        name: SCENARIOS[process.env.TEST_SCENARIO || "s1"].name,
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