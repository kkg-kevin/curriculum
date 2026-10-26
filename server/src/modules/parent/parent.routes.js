const express = require("express");
const { overview, timetable, childLogin, setChildLogin } = require("./parent.controller");

// Mounted at /api/parent behind protect + attachOwnRecords + parentOnly (app.js).
const router = express.Router();

router.get("/overview", overview);
router.get("/timetable", timetable);
router.get("/children/:id/login", childLogin);
router.put("/children/:id/login", setChildLogin);

module.exports = router;
