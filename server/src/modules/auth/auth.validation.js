const { z } = require("zod");

// Kept in one place so scoping in more roles later (teacher/learner) is a one-line change.
const USER_ROLES = ["admin", "teacher", "learner"];

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(USER_ROLES).default("admin"),
});

module.exports = {
  USER_ROLES,
  loginSchema,
  createUserSchema,
};
