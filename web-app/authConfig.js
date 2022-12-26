/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

require('dotenv').config();

const msal = require('@azure/msal-node');

const REDIRECT_URI = "http://localhost:3000/auth/redirect";
const POST_LOGOUT_REDIRECT_URI = "http://localhost:3000";
const GRAPH_ME_ENDPOINT = "https://graph.microsoft.com/v1.0/me";

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL Node configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
 */
const msalConfig = {
    auth: {
        clientId: process.env.AAD_CLIENT_ID, // 'Application (client) ID' of app registration in Azure portal - this value is a GUID
        authority: `https://login.microsoftonline.com/${process.env.AAD_TENANT_ID}`, // Full directory URL, in the form of https://login.microsoftonline.com/<tenant>
        clientSecret: process.env.AAD_CLIENT_SECRET // Client secret generated from the app registration in Azure portal
    },
    // cache: {
    //     cachePlugin: require('./utils/cachePlugin')('cache.json')
    // },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                if (containsPii) {
                    return;
                }
                switch (loglevel) {
                    case msal.LogLevel.Error:
                        console.error(message);
                        return;
                    case msal.LogLevel.Info:
                        console.info(message);
                        return;
                    case msal.LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case msal.LogLevel.Warning:
                        console.warn(message);
                        return;
                }
            },
            piiLoggingEnabled: true,
            logLevel: msal.LogLevel.Trace,
        }
    }
}

module.exports = {
    msalConfig,
    REDIRECT_URI,
    POST_LOGOUT_REDIRECT_URI,
    GRAPH_ME_ENDPOINT,
    TENANT_ID: process.env.AAD_TENANT_ID
};
