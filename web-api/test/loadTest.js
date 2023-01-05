require('dotenv').config();

const msal = require('@azure/msal-node');
const autocannon = require('autocannon');
const yargs = require('yargs');
const jsonfile = require('jsonfile');

const scenarios = [
    {
        instanceMode: 'single',
        cacheMode: 'none',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-single-no-cache',
        outputPath: './reports/results.txt'
    },
    {
        instanceMode: 'single',
        cacheMode: 'session',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-single-session-cache',
        outputPath: './reports/results.txt'
    },
    {
        instanceMode: 'multi',
        cacheMode: 'none',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-multi-no-cache',
        outputPath: './reports/results.txt'
    },
    {
        instanceMode: 'multi',
        cacheMode: 'session',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-multi-session-cache',
        outputPath: './reports/results.txt'
    },
    {
        instanceMode: 'multi',
        cacheMode: 'session',
        cacheSize: 10000,
        metadataCaching: true,
        scenarioName: 'obo-multi-session-cache-metadata',
        outputPath: './reports/results.txt'
    }
];

async function main() {
    const options = yargs
        .usage('Usage: --connections=10 --amount=10 --output=results.json')
        .option('connections', { alias: 'c', describe: 'number of concurrent connections', type: 'number', demandOption: true })
        .option('amount', { alias: 'a', describe: 'total amount of requests', type: 'number', demandOption: true })
        .option('output', { alias: 'o', describe: 'path to output file', type: 'string', demandOption: true })
        .option('scenario', { alias: 's', describe: 'scenario to run', type: 'string', demandOption: false })
        .argv;

    const accessToken = await getToken();

    const results = [];

    for (const scenario of scenarios) {
        const server = await startServer(scenario);

        const result = await makeRequest({
            connections: options.connections,
            amount: options.amount,
            output: options.output,
        }, accessToken);

        results.push(result);
        await server.close();
    }

    jsonfile.writeFileSync(`${options.output}`, { testruns: results }, { flag: 'w' });

    process.exit(0);
};

main();

async function startServer(scenario) {
    return new Promise((resolve, reject) => {
        const app = require('../app')(scenario);

        const server = app.listen(5000, () => {
            console.log(`Server listening on port ${5000}`);
            resolve(server);
        });
    });
};

async function getToken() {
    const pca = new msal.PublicClientApplication({
        auth: {
            clientId: process.env.AAD_CLIENT_ID_OF_CALLING_APP,
            authority: `https://login.microsoftonline.com/${process.env.AAD_TENANT_ID}`
        }
    });

    const [username, password] = [process.env.AAD_TEST_USER_USERNAME, process.env.AAD_TEST_USER_PASSWORD];

    const usernamePasswordRequest = {
        scopes: [`api://${process.env.AAD_CLIENT_ID}/access_as_user`],
        username: username,
        password: password
    };

    try {
        const tokenResponse = await pca.acquireTokenByUsernamePassword(usernamePasswordRequest);
        return tokenResponse.accessToken;
    } catch (error) {
        console.log(error);
    }
};

// async/await
async function makeRequest(options = {}, accessToken = "") {
    const result = await autocannon({
        url: 'http://localhost:5000/api/profile',
        connections: options.connections, //default
        amount: options.amount, // default
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return result;
};