const { performance, PerformanceObserver } = require("perf_hooks");
const fs = require('fs');
const chalk = require('chalk');
const msal = require('@azure/msal-node');
const axios = require('axios');
const NodeCache = require('node-cache');

const generateCache = require('../../common/generateCache');

class MsalWebApiWrapper {
    config;
    msalInstance;
    cryptoProvider;
    perfObserver;
    cacheProvider

    constructor(config) {
        this.config = config;
        this.cryptoProvider = new msal.CryptoProvider();
        this.msalInstance = new msal.ConfidentialClientApplication(this.config.msalConfig);

        if (this.config.cacheSize) {
            this.prepopulateCache(this.config.cacheSize);
        }

        if (this.config.cacheMode === 'session') {
            const nodeCache = new NodeCache({ 
                stdTTL: 3600, // in seconds
                checkperiod: 60 * 100,
                deleteOnExpire: true
            });

            this.cacheProvider = require('../utils/cacheProvider')(nodeCache);
        }

        this.initializePerfObserver();
    }

    prepopulateCache(size) {
        // generate a dummy cache and prepopulate the cache with it
        const dummyCache = generateCache(size);
        const stringifiedCache = JSON.stringify(dummyCache);
        this.msalInstance.getTokenCache().deserialize(stringifiedCache);

        // // or read from an existing cache file
        // const cacheFile = fs.readFileSync('./data/cache.json', 'utf8');
        // this.msalInstance.getTokenCache().deserialize(cacheFile);
    }

    initializePerfObserver() {
        this.perfObserver = new PerformanceObserver((items) => {
            items.getEntries().forEach((entry) => {
                const data = `${this.config.scenarioName} ${entry.name} ${entry.startTime} ${entry.duration}\n`;
                fs.appendFile(this.config.outputPath, data, function (err) {
                    if (err) throw err;
                });
            })
        });

        this.perfObserver.observe({ entryTypes: ["measure"], buffer: true });
    };

    /**
     * This function initializes the MSAL Node confidential client application
     * @param {string} instanceMode 
     * @returns 
     */
    getMsalInstance(instanceMode, metadata) {
        switch (instanceMode) {
            case "single":
                console.log(chalk.green("instanceMode is single, returning the same instance"));
                return this.msalInstance;
            case "multi":
                if (this.config.metadataCaching && metadata) {
                    console.log(chalk.green("instanceMode is multi with metadata caching enabled, returning a new instance"));
                    return new msal.ConfidentialClientApplication({
                        auth: {
                            ...this.config.msalConfig.auth,
                            cloudDiscoveryMetadata: metadata.cloudDiscoveryMetadata,
                            authorityMetadata: metadata.authorityMetadata,
                        },
                        system: {
                            ...this.config.msalConfig.system,
                        }
                    });
                }
                console.log(chalk.green("instanceMode is multi, returning a new instance"));
                return new msal.ConfidentialClientApplication(this.config.msalConfig);
            default:
                break;
        }
    };

    async acquireTokenOnBehalf(req, res, next) {
        let metadata;

        const userToken = req.get('authorization');
        const [bearer, tokenValue] = userToken.split(' ');

        const oboRequest = {
            oboAssertion: tokenValue,
            scopes: ['User.Read', 'offline_access']
        };

        if (this.config.metadataCaching) {
            if (!this.cacheProvider.has(`${req.authInfo['oid']}-metadataCache`)) {
                try {
                    console.log(chalk.green("metadata caching is enabled, fetching metadata from the authority and cloud discovery endpoints"))
                    // Get the metadata from the authority and cloud discovery endpoints
        
                    const [cloudDiscoveryMetadata, authorityMetadata] = await Promise.all([
                        this.getCloudDiscoveryMetadata(this.config.tenantId),
                        this.getAuthorityMetadata(this.config.tenantId)
                    ]);
                    
                    // Store the metadata in the session
                    metadata = {
                        cloudDiscoveryMetadata: JSON.stringify(cloudDiscoveryMetadata),
                        authorityMetadata: JSON.stringify(authorityMetadata),
                    };
    
                    this.cacheProvider.set(`${req.authInfo['oid']}-metadataCache`, metadata);
                } catch (error) {
                    return next(error);
                }
            }
        }

        const msalInstance = this.getMsalInstance(this.config.instanceMode, metadata);
    
        try {
            if (this.config.cacheMode === "session") {
                if (this.cacheProvider.has(`${req.authInfo['oid']}-tokenCache`)) {
                    const cache = this.cacheProvider.get(`${req.authInfo['oid']}-tokenCache`);
                    msalInstance.getTokenCache().deserialize(cache);
                }
            }
            performance.mark("acquireTokenOnBehalf-start");
            const response = await msalInstance.acquireTokenOnBehalfOf(oboRequest);
            performance.mark("acquireTokenOnBehalf-end");
            performance.measure("acquireTokenOnBehalf", "acquireTokenOnBehalf-start", "acquireTokenOnBehalf-end");
            if (this.config.cacheMode === "session") {
                this.cacheProvider.set(`${req.authInfo['oid']}-tokenCache`, msalInstance.getTokenCache().serialize());
            }
            req.oboToken = response.accessToken;
            next();
        } catch (error) {
            next(error);
        }
    }

    /**
     * Retrieves cloud discovery metadata from the /discovery/instance endpoint
     * @param {string} tenantId 
     * @returns 
     */
    async getCloudDiscoveryMetadata(tenantId) {
        const endpoint = 'https://login.microsoftonline.com/common/discovery/instance';

        try {
            const response = await axios.get(endpoint, {
                params: {
                    'api-version': '1.1',
                    'authorization_endpoint': `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
                }
            });
            return await response.data;
        } catch (error) {
            throw new Error(error);
        }
    }

    /**
     * Retrieves authority metadata from the /openid-configuration endpoint
     * @param {string} tenantId 
     * @returns 
     */
    async getAuthorityMetadata(tenantId) {
        const endpoint = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;

        try {
            const response = await axios.get(endpoint);
            return await response.data;
        } catch (error) {
            throw new Error(error);
        }
    }
}

module.exports = MsalWebApiWrapper;