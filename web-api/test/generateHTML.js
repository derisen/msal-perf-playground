const fs = require('fs');

const scenarios = [
    {
        instanceMode: 'single',
        cacheMode: 'none',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-single-no-cache',
        outputPath: './reports/benchmarks.md'
    },
    {
        instanceMode: 'single',
        cacheMode: 'session',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-single-session-cache',
        outputPath: './reports/benchmarks.md'
    },
    {
        instanceMode: 'multi',
        cacheMode: 'none',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-multi-no-cache',
        outputPath: './reports/benchmarks.md'
    },
    {
        instanceMode: 'multi',
        cacheMode: 'session',
        cacheSize: 10000,
        metadataCaching: false,
        scenarioName: 'obo-multi-session-cache',
        outputPath: './reports/benchmarks.md'
    },
    {
        instanceMode: 'multi',
        cacheMode: 'session',
        cacheSize: 10000,
        metadataCaching: true,
        scenarioName: 'obo-multi-session-cache-metadata',
        outputPath: './reports/benchmarks.md'
    }
];

function format(obj) {
    var str = JSON.stringify(obj, 0, 4),
        arr = str.match(/".*?":/g);

    for (var i = 0; i < arr.length; i++)
        str = str.replace(arr[i], arr[i].replace(/"/g, ''));

    return str;
}

function buildHtml() {
    const content = `
            const scenarios = ${format(scenarios)};

            new gridjs.Grid({
                columns: ["instanceMode", "cacheMode", "cacheSize", "metadataCaching", "scenarioName", "outputPath"],
                data: scenarios
            }).render(document.getElementById("wrapper"));
    `;

    return `
        <!DOCTYPE html>
        <html lang="en">
        
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
            <script src="https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js"></script>
            <link href="https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css" rel="stylesheet" />
        
            <title>Document</title>
        </head>
        <body>
            <div id="wrapper"></div>
            <script>
                ${content}
            </script>
        </body>
            
        </html>
    `;
};

function writeHtml() {
    const html = buildHtml();
    fs.writeFileSync('../reports/example.html', html);
}

writeHtml();