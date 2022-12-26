const { performance, PerformanceObserver } = require("perf_hooks");
const fs = require('fs');
const chalk = require('chalk');
const msal = require('@azure/msal-node');
const axios = require('axios');

const generateCache = require('../utils/generateCache');

class MsalWrapper {
    config;
    msalInstance;
    cryptoProvider;
    perfObserver;

    constructor(config) {
        this.config = config;
        this.cryptoProvider = new msal.CryptoProvider();
        this.msalInstance = new msal.ConfidentialClientApplication(this.config.msalConfig);

        if (this.config.cacheSize) {
            this.prepopulateCache(this.config.cacheSize);
        }

        this.initializePerfObserver();
    }

    prepopulateCache(size) {
        // generate a dummy cache and prepopulate the cache with it
        const dummyCache = generateCache(size);
        const stringifiedCache = JSON.stringify(dummyCache);

        // or read from a file
        //const cacheFile = fs.readFileSync('./data/cache.json', 'utf8');

        this.msalInstance.getTokenCache().deserialize(stringifiedCache);
    }

    initializePerfObserver() {
        this.perfObserver = new PerformanceObserver((items) => {
            items.getEntries().forEach((entry) => {
                const data = `| ${this.config.scenarioName} | ${entry.name} | ${entry.duration} |\n`;
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

    async login(req, res, next) {
        // create a GUID for csrf
        req.session.csrfToken = this.cryptoProvider.createNewGuid();

        /**
         * MSAL Node allows you to pass your custom state as state parameter in the Request object.
         * The state parameter can also be used to encode information of the app's state before redirect.
         * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
         */
        const state = this.cryptoProvider.base64Encode(
            JSON.stringify({
                csrfToken: req.session.csrfToken,
                redirectTo: '/'
            })
        );

        const authCodeUrlRequestParams = {
            state: state,

            /**
             * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
             * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
             */
            scopes: [],
        };

        const authCodeRequestParams = {

            /**
             * By default, MSAL Node will add OIDC scopes to the auth code request. For more information, visit:
             * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
             */
            scopes: [],
        };

        if (this.config.metadataCaching) {
            console.log(chalk.green("metadata caching is enabled, fetching metadata from the authority and cloud discovery endpoints"))
            // Get the metadata from the authority and cloud discovery endpoints
            const cloudDiscoveryMetadata = await this.getCloudDiscoveryMetadata(this.config.tenantId);
            const authorityMetadata = await this.getAuthorityMetadata(this.config.tenantId);
            
            // Store the metadata in the session
            req.session.metadata = {
                cloudDiscoveryMetadata: JSON.stringify(cloudDiscoveryMetadata),
                authorityMetadata: JSON.stringify(authorityMetadata),
            };
        }

        const msalInstance = this.getMsalInstance(this.config.instanceMode, req.session.metadata);

        // trigger the first leg of auth code flow
        return this.redirectToAuthCodeUrl(req, res, next, authCodeUrlRequestParams, authCodeRequestParams, msalInstance);
    };

    async acquireToken(req, res, next) {
        const msalInstance = this.getMsalInstance(this.config.instanceMode, req.session.metadata);

        try {
            performance.mark("acquireTokenSilent-start");
            if (this.config.cacheMode === "session") {
                console.log(chalk.green("cacheMode is session, deserializing the cache blob from session store"));
                // deserialize the cache blob from session store
                msalInstance.getTokenCache().deserialize(req.session.tokenCache);
            }
            const tokenResponse = await msalInstance.acquireTokenSilent({
                account: req.session.account,
                scopes: ["User.Read"],
            });
            if (this.config.cacheMode === "session") {
                console.log(chalk.green("cacheMode is session, serializing the cache blob to session store"));
                // deserialize the cache blob from session store
                req.session.tokenCache = msalInstance.getTokenCache().serialize();
            }
            performance.mark("acquireTokenSilent-end");
            performance.measure("acquireTokenSilent", "acquireTokenSilent-start", "acquireTokenSilent-end");

            req.session.accessToken = tokenResponse.accessToken;
            req.session.idToken = tokenResponse.idToken;
            req.session.account = tokenResponse.account;
            res.redirect('/users/profile');
        } catch (error) {
            if (error instanceof msal.InteractionRequiredAuthError) {
                // create a GUID for csrf
                req.session.csrfToken = this.cryptoProvider.createNewGuid();

                // encode the state param
                const state = this.cryptoProvider.base64Encode(
                    JSON.stringify({
                        csrfToken: req.session.csrfToken,
                        redirectTo: '/users/profile'
                    })
                );

                const authCodeUrlRequestParams = {
                    state: state,
                    scopes: ["User.Read"],
                };

                const authCodeRequestParams = {
                    scopes: ["User.Read"],
                };

                // trigger the first leg of auth code flow
                return this.redirectToAuthCodeUrl(req, res, next, authCodeUrlRequestParams, authCodeRequestParams, msalInstance)
            }
            next(error);
        }
    }

    async handleRedirect(req, res, next) {
        if (req.body.state) {
            const state = JSON.parse(this.cryptoProvider.base64Decode(req.body.state));

            // check if csrfToken matches
            if (state.csrfToken === req.session.csrfToken) {
                req.session.authCodeRequest.code = req.body.code; // authZ code
                req.session.authCodeRequest.codeVerifier = req.session.pkceCodes.verifier // PKCE Code Verifier

                try {
                    const msalInstance = this.getMsalInstance(this.config.instanceMode, req.session.metadata);
                    performance.mark("acquireTokenByCode-start");
                    const tokenResponse = await msalInstance.acquireTokenByCode(req.session.authCodeRequest);
                    if (this.config.cacheMode === "session") {
                        console.log(chalk.green("cacheMode is session, serializing the cache blob to session store"));
                        req.session.tokenCache = msalInstance.getTokenCache().serialize();
                    }
                    performance.mark("acquireTokenByCode-end");
                    performance.measure("acquireTokenByCode", "acquireTokenByCode-start", "acquireTokenByCode-end");

                    req.session.accessToken = tokenResponse.accessToken;
                    req.session.idToken = tokenResponse.idToken;
                    req.session.account = tokenResponse.account;
                    req.session.isAuthenticated = true;

                    res.redirect(state.redirectTo);
                } catch (error) {
                    next(error);
                }
            } else {
                next(new Error('csrf token does not match'));
            }
        } else {
            next(new Error('state is missing'));
        }
    }

    logout(req, res, next) {
        /**
         * Construct a logout URI and redirect the user to end the
         * session with Azure AD. For more information, visit:
         * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
         */
        const logoutUri =
            `${this.config.msalConfig.auth.authority}/oauth2/v2.0/logout?post_logout_redirect_uri=${this.config.postLogoutRedirectUri}`;

        req.session.destroy(() => {
            res.redirect(logoutUri);
        });
    }

    /**
     * Prepares the auth code request parameters and initiates the first leg of auth code flow
     * @param req: Express request object
     * @param res: Express response object
     * @param next: Express next function
     * @param authCodeUrlRequestParams: parameters for requesting an auth code url
     * @param authCodeRequestParams: parameters for requesting tokens using auth code
     */
    async redirectToAuthCodeUrl(req, res, next, authCodeUrlRequestParams, authCodeRequestParams, msalInstance) {

        // Generate PKCE Codes before starting the authorization flow
        const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();

        // Set generated PKCE codes and method as session vars
        req.session.pkceCodes = {
            challengeMethod: 'S256',
            verifier: verifier,
            challenge: challenge,
        };

        /**
         * By manipulating the request objects below before each request, we can obtain
         * auth artifacts with desired claims. For more information, visit:
         * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationurlrequest
         * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationcoderequest
         **/
        req.session.authCodeUrlRequest = {
            redirectUri: this.config.redirectUri,
            responseMode: msal.ResponseMode.FORM_POST, // recommended for confidential clients
            codeChallenge: req.session.pkceCodes.challenge,
            codeChallengeMethod: req.session.pkceCodes.challengeMethod,
            ...authCodeUrlRequestParams,
        };

        req.session.authCodeRequest = {
            redirectUri: this.config.redirectUri,
            code: "",
            ...authCodeRequestParams,
        };

        // Get url to sign user in and consent to scopes needed for application
        try {
            performance.mark("getAuthCodeUrl-start");
            const authCodeUrlResponse = await msalInstance.getAuthCodeUrl(req.session.authCodeUrlRequest);
            performance.mark("getAuthCodeUrl-end");
            performance.measure("getAuthCodeUrl", "getAuthCodeUrl-start", "getAuthCodeUrl-end");
            res.redirect(authCodeUrlResponse);
        } catch (error) {
            next(error);
        }
    };

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

module.exports = MsalWrapper;  // export the class