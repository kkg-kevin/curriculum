const express = require("express");
const {
  createBranch,
  getAllBranches,
  getMyBranch,
  getBranchById,
  updateBranch,
  deleteBranch,
  assignBranchAdmin,
  unassignBranchAdmin,
} = require("./branch.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Must come before "/:id" below — otherwise Express would match "mine" as the :id param.
router.route("/mine").get(authorize("branchAdmin"), getMyBranch);

// Managing branches (creating one, listing all, assigning which hubs belong to one via
// learning-hub.branchId, deleting one) stays global-admin-only — a branchAdmin only ever
// manages the hubs *within* their one branch (see learning-hubs/teachers/learners/classes/
// attendance routes), never the roster of branches.
router.route("/")
  .get(authorize("admin"), getAllBranches)
  .post(authorize("admin"), createBranch);
router.route("/:id")
  .get(authorize("admin"), getBranchById)
  .put(authorize("admin"), updateBranch)
  .delete(authorize("admin"), deleteBranch);

// Who manages this branch — assigning/removing is itself a global-admin action. Only one at a
// time (branch.branchAdminId) — assigning again replaces whoever was there.
router.route("/:id/admin")
  .post(authorize("admin"), assignBranchAdmin)
  .delete(authorize("admin"), unassignBranchAdmin);

module.exports = router;
