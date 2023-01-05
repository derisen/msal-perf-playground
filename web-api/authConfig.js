require('dotenv').config();

const msal = require('@azure/msal-node');
const TENANT_ID = process.env.AAD_TENANT_ID;
const CLIENT_ID = process.env.AAD_CLIENT_ID;
const GRAPH_ME_ENDPOINT = "https://graph.microsoft.com/v1.0/me";

const msalConfig = {
    auth: {
        clientId: process.env.AAD_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AAD_TENANT_ID}`,
        clientSecret: process.env.AAD_CLIENT_SECRET,
    },
    // cache: {
    //     cachePlugin: require('./utils/cachePlugin')('cache.json')
    // },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Verbose,
        },
    },
};

module.exports = {
    msalConfig,
    TENANT_ID,
    CLIENT_ID,
    GRAPH_ME_ENDPOINT,
};
