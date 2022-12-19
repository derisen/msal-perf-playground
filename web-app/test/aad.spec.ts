/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Page, Browser, BrowserContext, chromium } from "playwright";
import { test, expect, } from "@playwright/test";

import {
    Screenshot, createFolder, enterCredentials,
    SCREENSHOT_BASE_FOLDER_NAME,
    SAMPLE_HOME_URL,
    clickSignIn,
    clickSignOut
} from "./e2eTestUtils";

require('dotenv').config();

test.describe("Auth Code AAD Tests", () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;

    let username: string;
    let accountPwd: string;

    const screenshotFolder = `${SCREENSHOT_BASE_FOLDER_NAME}/web-app/aad`;

    test.beforeAll(async () => {
        browser = await chromium.launch();

        createFolder(screenshotFolder);

        [username, accountPwd] = [process.env.AAD_TEST_USER_USERNAME!, process.env.AAD_TEST_USER_PASSWORD!];
    });

    test.afterAll(async () => {
        await browser.close();
    });

    test.describe("Acquire Token", () => {
        test.beforeEach(async () => {
            context = await browser.newContext();
            page = await context.newPage();
            page.setDefaultTimeout(5000);
            page.on("dialog", async dialog => {
                console.log(dialog.message());
                await dialog.dismiss();
            });
        });

        test.afterEach(async () => {
            await page.close();
            await context.close();
        });

        test("Acquire token with AAD", async () => {
            const screenshot = new Screenshot(`${screenshotFolder}/acquire-token-with-aad`);
            await page.goto('/');
            await clickSignIn(page, screenshot);
            await enterCredentials(page, screenshot, username, accountPwd);
            await page.waitForFunction(`window.location.href.startsWith("${SAMPLE_HOME_URL}")`);
            await expect(page.locator(`text=${username}`).first()).toBeVisible();
            await page.waitForSelector("#acquireToken");
            await screenshot.takeScreenshot(page, "samplePagePostLogin");

            page.click("#acquireToken");
            await page.waitForFunction(`window.location.href.startsWith("${SAMPLE_HOME_URL}")`);
            await screenshot.takeScreenshot(page, "samplePageAcquireTokenCallGraph");
            await expect(page.locator(`text=Microsoft Graph API`).first()).toBeVisible();
            await expect(page.locator(`text=${username}`).first()).toBeVisible();

            await page.waitForSelector("#goBack");
            page.click("#goBack");

            await clickSignOut(page, screenshot);
            await page.locator(`text=${username}`).click()
            await page.waitForFunction(`window.location.href.startsWith("${SAMPLE_HOME_URL}")`);
            await screenshot.takeScreenshot(page, "samplePagePostLogout");
            await expect(page.locator(`text=${username}`).first()).not.toBeVisible();
        });
    });
});