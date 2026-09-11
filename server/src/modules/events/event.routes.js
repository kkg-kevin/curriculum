const express = require("express");
const { createEvent, getAllEvents, getEventById, updateEvent, deleteEvent } = require("./event.controller");

const router = express.Router();

// Admin-only — already gated at the app.js mount, same as competencies/pathways/inventory.
router.route("/").get(getAllEvents).post(createEvent);
router.route("/:id").get(getEventById).put(updateEvent).delete(deleteEvent);

module.exports = router;
