const express = require("express");
const {
  createBootcamp,
  listBootcamps,
  updateBootcamp,
  deleteBootcamp,
  createProject,
  listProjects,
  updateProject,
  deleteProject,
} = require("./public-site.controller");

// Mounted in app.js behind protect + authorize("admin") — content authoring for the two public
// listing pages above. Deliberately separate from public-site.routes.js so that router never
// needs a mixed public/protected middleware split (same reasoning as leads' two-router split).
const router = express.Router();

router.route("/bootcamps")
  .get(listBootcamps)
  .post(createBootcamp);
router.route("/bootcamps/:id")
  .put(updateBootcamp)
  .delete(deleteBootcamp);

router.route("/projects")
  .get(listProjects)
  .post(createProject);
router.route("/projects/:id")
  .put(updateProject)
  .delete(deleteProject);

module.exports = router;
