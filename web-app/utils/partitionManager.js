/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

function partitionManager(cacheClient, sessionId) {
    return {
        getKey: async () => {
            const sessionData = await cacheClient.get(`sess:${sessionId}`);
            const parsedSessionData = JSON.parse(sessionData); // parse the session data
            return parsedSessionData.account ? parsedSessionData.account.homeAccountId : "";
        },
        extractKey: async (accountEntity) => {
            if (accountEntity.hasOwnProperty("homeAccountId")) {
                return accountEntity.homeAccountId; // the homeAccountId is the partition key
            } else {
                throw new Error("homeAccountId is not defined");
            }
        }
    }
}

module.exports = partitionManager;