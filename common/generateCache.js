const crypto = require('crypto');

const dummyAccount = {
    home_account_id: "uid.cbaf2168-de14-4c72-9d88-f5f05366dbef",
    environment: "login.windows.net",
    realm: "cbaf2168-de14-4c72-9d88-f5f05366dbef",
    local_account_id: "uid",
    username: "janedoe.onmicrosoft.com",
    authority_type: "MSSTS",
    name: "Jane Doe",
    client_info: "eyJ1aWQiOiJhMjgzYTYwMS02YWQ0LTQ1MjgtOTc1ZC02YWJiZWZhN"
}

const dummyIdToken = {
    home_account_id: "uid.cbaf2168-de14-4c72-9d88-f5f05366dbef",
    environment: "login.windows.net",
    credential_type: "IdToken",
    client_id: "f2fe5017-b270-41f1-a3c8-0c9dd2f8d05e",
    secret: "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ii1LSTNROW5OUjdiUm",
    realm: "cbaf2168-de14-4c72-9d88-f5f05366dbef"
};

const dummyAccessToken = {
    home_account_id: "uid.cbaf2168-de14-4c72-9d88-f5f05366dbef",
    environment: "login.windows.net",
    credential_type: "AccessToken",
    client_id: "f2fe5017-b270-41f1-a3c8-0c9dd2f8d05e",
    secret: "eyJ0eXAiOiJKV1QiLCJub25jZSI6IktTZE15R1RhbUlXZFpYMU9wNHloaFhBTVRVV",
    realm: "cbaf2168-de14-4c72-9d88-f5f05366dbef",
    target: "openid profile email User.Read",
    cached_at: "1671926260",
    expires_on: "1671930508",
    extended_expires_on: "1671934757",
    token_type: "Bearer"
}

const dummyRefreshToken = {
    home_account_id: "uid.cbaf2168-de14-4c72-9d88-f5f05366dbef",
    environment: "login.windows.net",
    credential_type: "RefreshToken",
    client_id: "f2fe5017-b270-41f1-a3c8-0c9dd2f8d05e",
    secret: "DLA3VO7QrddgJg7WevrAgDs_wQA9P82duHA9flXH70MGMmvj_ESo39Nf6qMzELc4RZ1"
}

const generateCache = (size) => {
    const cache = {
        Account: {},
        IdToken: {},
        AccessToken: {},
        RefreshToken: {},
    };

    for (let i = 0; i < size; i++) {
        let uid = crypto.randomUUID();        
        for (key in cache) {
            switch (key) {
                case "Account":
                    cache[key][`${uid}.cbaf2168-de14-4c72-9d88-f5f05366dbef-login.windows.net-cbaf2168-de14-4c72-9d88-f5f05366dbef`] = dummyAccount;
                    break;
                case "IdToken":
                    cache[key][`${uid}.cbaf2168-de14-4c72-9d88-f5f05366dbef-login.windows.net-idtoken-f2fe5017-b270-41f1-a3c8-0c9dd2f8d05e-cbaf2168-de14-4c72-9d88-f5f05366dbef---`] = dummyIdToken;
                    break;
                case "AccessToken":
                    cache[key][`${uid}.cbaf2168-de14-4c72-9d88-f5f05366dbef-login.windows.net-accesstoken-f2fe5017-b270-41f1-a3c8-0c9dd2f8d05e-cbaf2168-de14-4c72-9d88-f5f05366dbef-openid profile email user.read--`] = dummyAccessToken;
                    break;
                case "RefreshToken":
                    cache[key][`${uid}.cbaf2168-de14-4c72-9d88-f5f05366dbef-login.windows.net-refreshtoken-f2fe5017-b270-41f1-a3c8-0c9dd2f8d05e----`] = dummyRefreshToken;
                    break;
            }
        }
    }

    return {
        ...cache,
        AppMetadata: {},
    };
}

module.exports = generateCache;
