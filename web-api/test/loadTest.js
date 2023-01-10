require('dotenv').config();

const msal = require('@azure/msal-node');
const yargs = require('yargs');
const autocannon = require('autocannon');
const fs = require('fs');

const scenarios = {
    s1: {
        instanceMode: 'single',
        cacheMode: 'none',
        cacheSize: 30000,
        metadataCaching: false,
        scenarioName: 'obo-single-no-cache',
        outputPath: './reports/measurements.txt'
    },
    s2: {
        instanceMode: 'single',
        cacheMode: 'session',
        cacheSize: 30000,
        metadataCaching: false,
        scenarioName: 'obo-single-token-cache-session',
        outputPath: './reports/measurements.txt'
    },
    s3: {
        instanceMode: 'multi',
        cacheMode: 'session',
        cacheSize: 30000,
        metadataCaching: false,
        scenarioName: 'obo-multi-token-cache-session',
        outputPath: './reports/measurements.txt'
    },
    s4: {
        instanceMode: 'multi',
        cacheMode: 'session',
        cacheSize: 30000,
        metadataCaching: true,
        scenarioName: 'obo-multi-token-metadata-cache-session',
        outputPath: './reports/measurements.txt'
    }
};

async function main() {
    const options = yargs
        .usage('Usage: --connections=10 --amount=10 --output=results.json')
        .option('connections', { alias: 'c', describe: 'number of concurrent connections', type: 'number', demandOption: false })
        .option('amount', { alias: 'a', describe: 'total amount of requests', type: 'number', demandOption: false })
        .option('output', { alias: 'o', describe: 'path to output file', type: 'string', demandOption: false })
        .option('scenario', { alias: 's', describe: 'scenario to run', type: 'string', demandOption: false })
        .argv;

    const accessToken = await getToken();

    const server = await startServer(scenarios[options.scenario || 's1']);

    await makeRequest({
        title: scenarios[options.scenario || 's1'].scenarioName,
        connections: options.connections || 10,
        amount: options.amount || 100,
        output: options.output || './reports/testruns.txt',
    }, accessToken);

    await stopServer(server);

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

async function stopServer(server) {
    return new Promise((resolve, reject) => {
        server.close(() => {
            console.log('Server closed');
            resolve();
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

async function makeRequest(options = {}, accessToken = "") {
    const result = await autocannon({
        title: options.title,
        url: 'http://localhost:5000/api/profile',
        connections: options.connections, //default
        amount: options.amount, // default
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    // console.log(result);

    // console.log(autocannon.printResult(result, {
    //     renderResultsTable: true,
    //     renderLatencyTable: true,
    // }));

    const data = `${result.title} ${(new Date(result.finish) - new Date(result.start)) / 1000} ${result.connections} ${result.latency.average} ${result.requests.average} ${result.throughput.average}\n`;

    fs.appendFileSync(options.output, data, function (err) {
        if (err) throw err;
    });
};