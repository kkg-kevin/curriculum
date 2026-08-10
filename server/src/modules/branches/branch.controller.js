const asyncHandler = require("express-async-handler");
const BranchService = require("./branch.service");
const AuthService = require("../auth/auth.service");
const { createBranchSchema, updateBranchSchema, assignAdminSchema } = require("./branch.validation");

const createBranch = asyncHandler(async (req, res) => {
  const data = createBranchSchema.parse(req.body);
  const branch = await BranchService.create(data);
  res.status(201).json({ success: true, data: branch });
});

const getAllBranches = asyncHandler(async (req, res) => {
  const branches = await BranchService.getAll();
  res.json({ success: true, data: branches, count: branches.length });
});

// What a "branchAdmin" account lands on after login — their own branch, resolved off
// req.ownBranch (attachOwnRecords) rather than a client-supplied id.
const getMyBranch = asyncHandler(async (req, res) => {
  if (!req.ownBranch) {
    const err = new Error("No branch is assigned to this account yet");
    err.statusCode = 404;
    throw err;
  }
  const branch = await BranchService.getById(req.ownBranch.id);
  res.json({ success: true, data: branch });
});

const getBranchById = asyncHandler(async (req, res) => {
  const branch = await BranchService.getById(req.params.id);
  res.json({ success: true, data: branch });
});

const updateBranch = asyncHandler(async (req, res) => {
  const data = updateBranchSchema.parse(req.body);
  const branch = await BranchService.update(req.params.id, data);
  res.json({ success: true, data: branch });
});

const deleteBranch = asyncHandler(async (req, res) => {
  const result = await BranchService.delete(req.params.id);
  res.json({ success: true, ...result });
});

/* ── Branch admin — the one account delegated to manage every hub in this branch ─────────── */

const assignBranchAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = assignAdminSchema.parse(req.body);
  const user = await AuthService.setOrCreatePassword({ name, email, password, role: "branchAdmin" });
  const branch = await BranchService.setBranchAdmin(req.params.id, user.id);
  res.json({ success: true, data: branch });
});

const unassignBranchAdmin = asyncHandler(async (req, res) => {
  const branch = await BranchService.setBranchAdmin(req.params.id, null);
  res.json({ success: true, data: branch });
});

module.exports = {
  createBranch,
  getAllBranches,
  getMyBranch,
  getBranchById,
  updateBranch,
  deleteBranch,
  assignBranchAdmin,
  unassignBranchAdmin,
};
