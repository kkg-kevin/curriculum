const express = require("express");
const { list, markRead, markAllRead } = require("./notification.controller");

const router = express.Router();

// Scoped entirely by req.user.id (see notification.controller.js) — every role reads/writes only
// its own feed, so no attachOwnRecords/authorize gate is needed here, unlike most other modules.
router.get("/", list);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

module.exports = router;
