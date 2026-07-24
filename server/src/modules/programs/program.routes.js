const express = require("express");
const { createProgram, getAllPrograms, getProgramById, updateProgram, deleteProgram } = require("./program.controller");

const router = express.Router();

// Admin-only — already gated at the app.js mount, same as competencies/learning-areas/inventory.
router.route("/").get(getAllPrograms).post(createProgram);
router.route("/:id").get(getProgramById).put(updateProgram).delete(deleteProgram);

module.exports = router;
