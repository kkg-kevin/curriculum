const express = require("express");
const { getPublicProfile } = require("./learner.controller");

const router = express.Router();

// Deliberately mounted in app.js WITHOUT `protect`/`attachOwnRecords` — this is the one route in
// the whole app meant to work with no logged-in session at all (someone scanning a printed QR
// code on their own phone). The token in the URL is the only access control; getPublicProfile
// returns a hand-built, deliberately narrow field set — see its comment in learner.service.js.
router.get("/:token", getPublicProfile);

module.exports = router;
