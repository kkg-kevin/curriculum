const express = require("express");
const { createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses } = require("./class.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages classes within its own school only. "teacher" only reads classes in its own
// school (dashboard finds "my classes" by classTeacherId client-side, verified again server-side
// on the by-id route). "learner" only reads its own class.
router.route("/bulk").post(authorize("admin", "school"), bulkCreateClasses);
router.route("/")
  .get(authorize("admin", "school", "teacher"), getAllClasses)
  .post(authorize("admin", "school"), createClass);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getClassById)
  .put(authorize("admin", "school"), updateClass)
  .delete(authorize("admin", "school"), deleteClass);

module.exports = router;
