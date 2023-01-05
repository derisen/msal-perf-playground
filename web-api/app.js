/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

require('dotenv').config();

const express = require("express");
const morgan = require("morgan");
const cors = require('cors');

const passport = require("passport");
const passportAzureAd = require('passport-azure-ad');

const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const { TENANT_ID, CLIENT_ID } = require('./authConfig');

// const yargs = require('yargs');

// const options = yargs
//     .usage('Usage: --instanceMode <singe | multi> --cacheMode <session | distributed> --cacheSize <1000> --metadataCaching <metadata_caching> --scenarioName <some-test>--outputPath <output_path>')
//     .option('instanceMode', { alias: 'im', describe: 'instance mode', type: 'string', demandOption: true })
//     .option('cacheMode', { alias: 'cm', describe: 'cache mode', type: 'string', demandOption: false })
//     .option('cacheSize', { alias: 'cs', describe: 'cache size', type: 'number', demandOption: false })
//     .option('metadataCaching', { alias: 'mc', describe: 'whether to cache metadata', type: 'boolean', demandOption: true })
//     .option('scenarioName', { alias: 'sn', describe: 'describe current scenario', type: 'string', demandOption: true })
//     .option('outputPath', { alias: 'out', describe: 'path to measurement output', type: 'string', demandOption: true })
//     .argv;

function main(options) {
    const app = express();

    /**
     * Enable CORS middleware. In production, modify as to allow only designated origins and methods.
     * If you are using Azure App Service, we recommend removing the line below and configure CORS on the App Service itself.
     */
    app.use(cors());

    app.use(morgan('dev'));
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    const bearerStrategy = new passportAzureAd.BearerStrategy(
        {
            identityMetadata: `https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration`,
            issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
            clientID: CLIENT_ID,
            audience: CLIENT_ID,
            validateIssuer: true,
            passReqToCallback: false,
            loggingLevel: "info",
            loggingNoPII: true,
            scope: ['access_as_user']
        },
        (token, done) => {
            // Send user info using the second argument
            done(null, {}, token);
        }
    );

    app.use(passport.initialize());
    passport.use(bearerStrategy);

    app.use(
        '/api/profile',
        passport.authenticate('oauth-bearer', { session: false }),
        authRouter({
            instanceMode: options.instanceMode,
            cacheMode: options.cacheMode,
            cacheSize: options.cacheSize,
            metadataCaching: options.metadataCaching,
            outputPath: options.outputPath,
            scenarioName: options.scenarioName
        }),
        usersRouter,
        (err, req, res, next) => {
            /**
             * Add your custom error handling logic here. For more information, see:
             * http://expressjs.com/en/guide/error-handling.html
             */

            // set locals, only providing error in development
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};

            // send error response
            res.status(err.status || 500).send(err);
        }
    );

    return app;
};

module.exports = main;
