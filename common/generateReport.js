const fs = require('fs');
const readline = require('readline');
const yargs = require('yargs');
const open = require('open');

async function main() {
    const options = yargs
        .usage('Usage: --measurements=measurements.txt --testruns=testruns.txt --output=report.html')
        .option('apptype', { alias: 't', describe: 'app type', type: 'string', demandOption: true })
        .option('measurements', { alias: 'm', describe: 'path to measurements', type: 'string', demandOption: true })
        .option('testruns', { alias: 'r', describe: 'path to test runs', type: 'string', demandOption: true })
        .option('output', { alias: 'o', describe: 'path to output file', type: 'string', demandOption: false })
        .argv;

    const objectKeysForAppType = {
        webapp: {
            measurements: ["scenario", "routine", "startTime", "duration"],
            testruns: ["title", "status", "duration"]
        },
        webapi: {
            measurements: ["scenario", "routine", "startTime", "duration"],
            testruns: ["title", "duration", "connections", "average_latency", "average_requests", "average_throughput"]
        },
    };

    const [measurementData, testRunData] = await Promise.all([
        textToJson(options.measurements, objectKeysForAppType[options.apptype].measurements),
        textToJson(options.testruns, objectKeysForAppType[options.apptype].testruns)
    ]);

    await buildHtml(options.apptype, measurementData, testRunData, options.output || '../benchmarks.html');

    await open(options.output || '../benchmarks.html');
}

main();

async function buildHtml(appType, measurementData, testRunData, outputPath) {
    let content;

    switch (appType) {
        case 'webapp':
            content = `
                const measurements = ${format(measurementData)};
                const testRuns = ${format(testRunData)};

                new gridjs.Grid({
                    columns: Object.keys(measurements[0]),
                    data: measurements,
                    sort: true,
                    resizable: true,
                }).render(document.getElementById("measurements-table"));

                new Chart(
                    document.getElementById('measurements-graph'),
                    {
                        type: 'bar',
                        data: {
                            labels: Object.keys(_.groupBy(measurements, 'scenario')),
                            datasets: Object.values(_.groupBy(measurements, 'routine')).map(r => {
                                return {
                                    label: r[0].routine,
                                    data: r.map(v => v.duration)
                                }
                            }).concat({
                                label: 'Total Run Time',
                                data: testRuns.map(v => v.duration - 5000),
                                type: 'line',
                                order: 0
                            }),
                        },
                        options: {
                            plugins: {
                                title: {
                                    display: true,
                                    text: "Benchmark Results"
                                },
                            },
                            responsive: true,
                            scales: {
                                x: {
                                    stacked: true,
                                },
                                y: {
                                    stacked: true,
                                }
                            }
                        }
                    }
                );
            `;
            break;
        case 'webapi':
            content = `
                const testRuns = ${format(testRunData)};

                new gridjs.Grid({
                    columns: Object.keys(testRuns[0]),
                    data: testRuns,
                    sort: true,
                    resizable: true,
                }).render(document.getElementById("testruns-table"));

                new Chart(
                    document.getElementById('testruns-graph'),
                    {
                        type: 'line',
                        data: {
                            labels: Object.keys(_.groupBy(testRuns, 'title')),
                            datasets: Object.values(_.groupBy(testRuns, 'title')).map(r => {
                                return {
                                    label: r[0].routine,
                                    data: r.map(v => v.duration)
                                }
                            }),
                            datasets: [
                                {
                                    label: 'Latency',
                                    data: testRuns.map(v => v.average_latency),
                                },
                                {
                                    label: 'Requests',
                                    data: testRuns.map(v => v.average_requests),
                                },
                                {
                                    label: 'Throughput',
                                    data: testRuns.map(v => v.average_throughput),
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: {
                                    position: 'top',
                                },
                                title: {
                                    display: true,
                                    text: 'Load test results'
                                },
                            }
                        },
                    }
                );
            `;
            break;
        default:
            throw new Error('Invalid app type');
    }

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js"></script>
            <link href="https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css" rel="stylesheet" />
            <title>Benchmarks - ${new Date().toLocaleString()}</title>
        </head>
        <body>
                <h1 style="text-align: center;">Benchmarks for ${appType} - ${new Date().toLocaleString()}</h1>
                <div class="column" style="margin: auto; width: 50%;"><canvas id="measurements-graph"><br/></div>
                <div class="column" style="margin: auto; width: 50%;"><div id="measurements-table"></div></div>
                <div class="column" style="margin: auto; width: 50%;"><canvas id="testruns-graph"><br/></div>
                <div class="column" style="margin: auto; width: 60%;"><div id="testruns-table"></div></div>
            <script>
                ${content}
            </script>
        </body>
        </html>
    `;

    fs.writeFileSync(outputPath, html);
};

async function textToJson(sourcePath, objectKeys) {
    const results = [];
    const fileStream = fs.createReadStream(sourcePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        let result = {};

        objectKeys.forEach((key, index) => {
            result[key] = line.split(' ')[index];
        });

        results.push(result);
    }

    return results;
}

function format(obj) {
    var str = JSON.stringify(obj, 0, 4),
        arr = str.match(/".*?":/g);

    for (var i = 0; i < arr.length; i++)
        str = str.replace(arr[i], arr[i].replace(/"/g, ''));

    return str;
}

function groupBy(list, predicate) {
    return list.reduce((a, b, i) => ((a[predicate(b, i, list)] ||= []).push(b), a), {}); s
}