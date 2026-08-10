const BranchModel = require("./branch.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const UserModel = require("../auth/user.model");

// Resolved fresh from live records each read, never stored, so admin name/email and hub count
// can't drift (same posture as curriculum.service.js's enrichCurriculum / program.service.js's
// enrich()).
async function enrich(branch) {
  if (!branch) return branch;
  const admin = branch.branchAdminId ? await UserModel.findById(branch.branchAdminId) : null;
  const hubs = await LearningHubModel.findAll({ branchId: branch.id, includeDrafts: true });
  return {
    ...branch,
    branchAdmin: admin ? { id: admin.id, name: admin.name, email: admin.email } : null,
    hubCount: hubs.length,
  };
}

const BranchService = {
  async getAll() {
    const branches = await BranchModel.findAll();
    return Promise.all(branches.map(enrich));
  },

  async getById(id) {
    const branch = await BranchModel.findById(id);
    if (!branch) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(branch);
  },

  async create(data) {
    return enrich(await BranchModel.create(data));
  },

  async update(id, data) {
    const branch = await BranchModel.update(id, data);
    if (!branch) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(branch);
  },

  async delete(id) {
    const deleted = await BranchModel.delete(id);
    if (!deleted) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    // Hubs under this branch become standalone rather than left pointing at a deleted branch —
    // matches how removing a curriculum doesn't leave hubs' curriculumId dangling either.
    const hubs = await LearningHubModel.findAll({ branchId: id, includeDrafts: true });
    await Promise.all(hubs.map((hub) => LearningHubModel.update(hub.id, { branchId: null })));
    return { deleted: true };
  },

  // Bypasses updateBranchSchema entirely — branchAdminId is deliberately never part of the
  // general update payload, only ever set here by the dedicated assign/unassign actions.
  async setBranchAdmin(id, branchAdminId) {
    const branch = await BranchModel.update(id, { branchAdminId });
    if (!branch) {
      const err = new Error("Branch not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(branch);
  },
};

module.exports = BranchService;
