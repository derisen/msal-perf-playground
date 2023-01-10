# perf-playground

Simple testing suite to obtain performance metrics for [confidential client](https://learn.microsoft.com/azure/active-directory/develop/msal-client-applications) applications using [MSAL Node](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node).

There are 2 samples to run tests against:

* Express web app acquiring tokens using [OAuth 2.0 authorization code flow](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow)
* Express web api acquiring tokens using [OAuth 2.0 on-behalf-of flow](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow)

## installation

Clone the repository. Then locate the cloned folder in your terminal and run:

> Make sure you have Node.js v14 or later installed on your system, or get it from [here](https://nodejs.org)

```console
    npm install
```

You'll also need to [register an Azure AD application](https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app) for each sample, and create a test user account in the tenant that the apps are registered at. To do so, you can run the provided [Configure.ps1](./scripts/Configure.ps1) PowerShell script, which will register the apps, create a test user and update the configuration files:

> :warning: Make sure you have PowerShell v7 installed on your system, or get it from [here](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.3)

```console
    
```

## running tests

### web app

To run tests against the web app project, type:

```console
    cd web-app
    npm run test:all
```

This will run all tests defined in the [playwright.config.ts](./web-app/playwright.config.ts). Afterwards, the generated report will open in your system's default browser. If you like, you can run tests individually, or change the default parameters like instance mode, cache size and etc. See [package.json](./web-app/package.json) for more.

### web api

To run tests against the web app project, type:

```console
    cd web-api
    npm run test:all
```

This will run all tests defined in the [loadTest.js](./web-api/test/loadTest.js). Afterwards, the generated report will open in your system's default browser. If you like, you can run tests individually, or change the default parameters like instance mode, cache size and etc. See [loadTest.js](./web-api/test/loadTest.js) for more.

## remarks

You can use [Clinic.js](https://clinicjs.org/) to do performance profiling for the samples in this repo. Read more on how to interpret Clinic.js results [here](https://clinicjs.org/documentation/doctor/04-reading-a-profile/).

## see also:

* [Playwright](https://playwright.dev/)
* [autocannon](https://github.com/mcollina/autocannon)