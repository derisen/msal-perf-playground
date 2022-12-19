/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const express = require('express');
const MsalWrapper = require('../common/MsalWrapper');

const {
    msalConfig,
    REDIRECT_URI,
    POST_LOGOUT_REDIRECT_URI
} = require('../authConfig');

module.exports = (options) => {
    const msalWrapper = new MsalWrapper({
        msalConfig: msalConfig,
        redirectUri: REDIRECT_URI,
        postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
        instanceMode: options.instanceMode,
        cacheMode: options.cacheMode,
        metadataCaching: options.metadataCaching,
        outputPath: options.outputPath,
    });

    const router = express.Router();

    router.get('/signin', (req, res, next) => msalWrapper.login(req, res, next));
    router.get('/acquireToken', (req, res, next) => msalWrapper.acquireToken(req, res, next));
    router.post('/redirect', (req, res, next) => msalWrapper.handleRedirect(req, res, next));
    router.get('/signout', (req, res, next) => msalWrapper.logout(req, res, next));

    return router;
};