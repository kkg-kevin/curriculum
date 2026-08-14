const express = require("express");
const {
  createGroup,
  listGroupsForClass,
  renameGroup,
  deleteGroup,
  addMember,
  removeMember,
  getGroupForLearner,
} = require("./class-group.controller");
const { authorize } = require("../../../shared/middleware/auth.middleware");

const router = express.Router();

// Group management is a day-to-day teacher action within their own class, same posture as
// attendance (not the admin/school-only posture class core-field edits use) — ownership is
// enforced in the controller off the class the group belongs to.
router.post("/", authorize("admin", "school", "branchAdmin", "teacher"), createGroup);
router.get("/", authorize("admin", "school", "branchAdmin", "teacher"), listGroupsForClass);
router.patch("/:id", authorize("admin", "school", "branchAdmin", "teacher"), renameGroup);
router.delete("/:id", authorize("admin", "school", "branchAdmin", "teacher"), deleteGroup);
router.post("/:id/members", authorize("admin", "school", "branchAdmin", "teacher"), addMember);
router.delete("/:id/members/:learnerId", authorize("admin", "school", "branchAdmin", "teacher"), removeMember);

// Learner-facing: which group they're in for one class. Also readable by staff roles (ownership
// enforced in the controller).
router.get("/class/:classId/learner/:learnerId", authorize("admin", "school", "branchAdmin", "teacher", "learner"), getGroupForLearner);

module.exports = router;
