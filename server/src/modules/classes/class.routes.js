const express = require("express");
const { createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses } = require("./class.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages classes within its own school only; "branchAdmin" manages classes across
// every hub in its branch (same shape, wider set — enforced server-side). "teacher" only reads
// classes in its own school (dashboard finds "my classes" by classTeacherId client-side,
// verified again server-side on the by-id route). "learner" only reads its own class.
router.route("/bulk").post(authorize("admin", "school", "branchAdmin"), bulkCreateClasses);
router.route("/")
  .get(authorize("admin", "school", "teacher", "branchAdmin"), getAllClasses)
  .post(authorize("admin", "school", "branchAdmin"), createClass);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getClassById)
  .put(authorize("admin", "school", "branchAdmin"), updateClass)
  .delete(authorize("admin", "school", "branchAdmin"), deleteClass);

module.exports = router;
