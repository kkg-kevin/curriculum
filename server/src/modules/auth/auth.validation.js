const { z } = require("zod");

// Kept in one place so scoping in more roles later is a one-line change.
const USER_ROLES = ["admin", "school", "teacher", "learner", "curriculumAdmin", "branchAdmin"];

// Public self-signup is only ever allowed to create these roles — "admin" is never reachable
// from this schema, so privilege escalation via the signup form isn't possible even if the
// controller forgets to double-check. Admins are seeded/created by another admin only.
const PUBLIC_SIGNUP_ROLES = ["school", "teacher", "learner"];

// Not a strict email format — a learner may log in with their username instead of the
// guardian's email (see auth.service.js's login, which tries both).
const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(PUBLIC_SIGNUP_ROLES, { errorMap: () => ({ message: "Select a valid role" }) }),
});

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(USER_ROLES).default("admin"),
});

// Self-service account update — deliberately just the photo for now (no self-service page for
// name/email/password exists yet). No .default() on purpose: an absent key must stay undefined
// so a PUT that only sends `photo` can't zero out anything else added here later.
const updateMeSchema = z.object({
  photo: z.string().optional().nullable(),
});

module.exports = {
  USER_ROLES,
  PUBLIC_SIGNUP_ROLES,
  loginSchema,
  signupSchema,
  createUserSchema,
  updateMeSchema,
};
