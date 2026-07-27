const { z } = require("zod");

// branchAdminId (the one account delegated to manage every hub under this branch — mirrors
// curriculum.curriculumAdminId, a single outward-pointing field rather than a separate
// collection, since there's only ever one at a time) is deliberately absent here. It's only
// ever written by the dedicated assign/unassign handlers in branch.controller.js.
const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(150),
});

const updateBranchSchema = createBranchSchema.partial();

// Assigning a branch admin always sets up their login too — a branchAdminId with no working
// login would be useless.
const assignAdminSchema = z.object({
  name:     z.string().min(1, "Name is required").max(150),
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

module.exports = { createBranchSchema, updateBranchSchema, assignAdminSchema };
