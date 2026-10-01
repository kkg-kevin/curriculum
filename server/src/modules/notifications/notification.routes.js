const express = require("express");
const { list, markRead, markAllRead, getEmailPreferences, updateEmailPreferences } = require("./notification.controller");

const router = express.Router();

// Scoped entirely by req.user.id (see notification.controller.js) — every role reads/writes only
// its own feed, so no attachOwnRecords/authorize gate is needed here, unlike most other modules.
router.get("/", list);
// Which notifications this account also gets by email.
router.get("/email-preferences", getEmailPreferences);
router.put("/email-preferences", updateEmailPreferences);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

module.exports = router;
