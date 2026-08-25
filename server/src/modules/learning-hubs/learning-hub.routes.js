const express = require("express");
const {
  createLearningHub,
  getAllLearningHubs,
  getMyLearningHubs,
  getLearningHubById,
  getHubCurricula,
  updateLearningHub,
  attachHubCurriculum,
  updateHubCurriculumStatus,
  detachHubCurriculum,
  deleteLearningHub,
  getHubTeachers,
} = require("./learning-hub.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Must come before "/:id" below, otherwise Express would match "mine" as the :id param.
router.route("/mine").get(authorize("school"), getMyLearningHubs);

router.route("/")
  .get(authorize("admin", "school"), getAllLearningHubs)
  .post(authorize("admin"), createLearningHub);

router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getLearningHubById)
  .put(authorize("admin", "school"), updateLearningHub)
  .delete(authorize("admin"), deleteLearningHub);

router.route("/:id/curricula")
  .get(authorize("admin", "school"), getHubCurricula)
  .post(authorize("admin"), attachHubCurriculum);

router.route("/:id/curricula/:curriculumId/status")
  .patch(authorize("admin"), updateHubCurriculumStatus);

router.route("/:id/curricula/:curriculumId")
  .delete(authorize("admin"), detachHubCurriculum);

// Read-only mirror of the teacher-hub link table.
router.route("/:id/teachers/links")
  .get(authorize("admin", "school"), getHubTeachers);

module.exports = router;
