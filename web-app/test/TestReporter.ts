import { Reporter } from '@playwright/test/reporter';
const fs = require('fs');

class TestReporter implements Reporter {
    testName: string;

    onBegin(config, suite) {
        this.testName = config.metadata.name;
        console.log(`Starting the run with ${suite.allTests().length} tests`);
    }

    onTestBegin(test) {
        console.log(`Starting test ${test.title}`);
    }

    onTestEnd(test, result) {
        const data = `| ${this.testName} | ${result.status} | ${result.duration} |\n`;

        fs.appendFile("./reports/testruns.md", data, function (err) {
            if (err) throw err;
        });
    }

    onEnd(result) {
        console.log(`Finished the run: ${result.status}`);
    }
}
export default TestReporter;