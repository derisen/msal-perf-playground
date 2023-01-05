const fs = require('node:fs');
const readline = require('node:readline');

async function processLineByLine(path = "./reports/results.txt") {
    const results = [];
    const fileStream = fs.createReadStream(path);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        results.push({
            scenarioName: line.split(' ')[0],
            routineName: line.split(' ')[1],
            duration: line.split(' ')[2],
            timestampt: line.split(' ')[3],
        });
    }

    console.log(results)
    return results;
}

processLineByLine();