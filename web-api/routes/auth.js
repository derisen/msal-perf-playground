/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const express = require('express');
const MsalWebApiWrapper = require('../auth/MsalWebApiWrapper');

const {
    msalConfig,
    TENANT_ID,
} = require('../authConfig');

module.exports = (options) => {
    const msalWrapper = new MsalWebApiWrapper({
        msalConfig: msalConfig,
        tenantId: TENANT_ID,
        instanceMode: options.instanceMode,
        cacheMode: options.cacheMode,
        cacheSize: options.cacheSize,
        metadataCaching: options.metadataCaching,
        outputPath: options.outputPath,
        scenarioName: options.scenarioName
    });

    const router = express.Router();

    router.get('/', (req, res, next) => msalWrapper.acquireTokenOnBehalf(req, res, next));
    return router;
};