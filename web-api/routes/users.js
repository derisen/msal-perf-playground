const express = require('express');
const fetch = require('../fetch');

const { GRAPH_ME_ENDPOINT } = require('../authConfig');

// initialize router
const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const graphResponse = await fetch(GRAPH_ME_ENDPOINT, req.oboToken);
        res.send(graphResponse);
    } catch (error) {
        console.log(error);
        next(error);
    }
});

module.exports = router;