const BranchModel = require("./branch.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const UserModel = require("../auth/user.model");

// Resolved fresh from live records each read, never stored, so admin name/email and hub count
// can't drift (same posture as curriculum.service.js's enrichCurriculum / program.service.js's
// enrich()).
function enrich(branch) {
  if (!branch) return branch;
  const admin = branch.branchAdminId ? UserModel.findById(branch.branchAdminId) : null;
  return {
    ...branch,
    branchAdmin: admin ? { id: admin.id, name: admin.name, email: admin.email } : null,
    hubCount: LearningHubModel.findAll({ branchId: branch.id, includeDrafts: true }).length,
  };
}

const BranchService = {
  getAll() {
    return BranchModel.findAll().map(enrich);
  },

  getById(id) {
    const branch = BranchModel.findById(id);
    if (!branch) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(branch);
  },

  create(data) {
    return enrich(BranchModel.create(data));
  },

  update(id, data) {
    const branch = BranchModel.update(id, data);
    if (!branch) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(branch);
  },

  delete(id) {
    const deleted = BranchModel.delete(id);
    if (!deleted) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    // Hubs under this branch become standalone rather than left pointing at a deleted branch —
    // matches how removing a curriculum doesn't leave hubs' curriculumId dangling either.
    LearningHubModel.findAll({ branchId: id, includeDrafts: true })
      .forEach((hub) => LearningHubModel.update(hub.id, { branchId: null }));
    return { deleted: true };
  },

  // Bypasses updateBranchSchema entirely — branchAdminId is deliberately never part of the
  // general update payload, only ever set here by the dedicated assign/unassign actions.
  setBranchAdmin(id, branchAdminId) {
    const branch = BranchModel.update(id, { branchAdminId });
    if (!branch) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(branch);
  },
};

module.exports = BranchService;
