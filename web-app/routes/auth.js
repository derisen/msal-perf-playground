/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const express = require('express');
const MsalWebAppWrapper = require('../auth/MsalWebAppWrapper');

const {
    msalConfig,
    REDIRECT_URI,
    POST_LOGOUT_REDIRECT_URI,
    TENANT_ID,
} = require('../authConfig');

module.exports = (options) => {
    const msalWrapper = new MsalWebAppWrapper({
        msalConfig: msalConfig,
        redirectUri: REDIRECT_URI,
        postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
        tenantId: TENANT_ID,
        instanceMode: options.instanceMode,
        cacheMode: options.cacheMode,
        cacheSize: options.cacheSize,
        metadataCaching: options.metadataCaching,
        outputPath: options.outputPath,
        scenarioName: options.scenarioName
    });

    const router = express.Router();

    router.get('/signin', (req, res, next) => msalWrapper.login(req, res, next));
    router.get('/acquireToken', (req, res, next) => msalWrapper.acquireToken(req, res, next));
    router.post('/redirect', (req, res, next) => msalWrapper.handleRedirect(req, res, next));
    router.get('/signout', (req, res, next) => msalWrapper.logout(req, res, next));

    return router;
};