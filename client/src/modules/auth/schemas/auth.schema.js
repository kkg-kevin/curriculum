import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Mirrors server/src/modules/auth/auth.validation.js's PUBLIC_SIGNUP_ROLES — "admin" is
// never offered here, accounts with that role are seeded/created by an existing admin only.
export const SIGNUP_ROLES = [
  { value: "school", label: "School" },
  { value: "teacher", label: "Tech Educator" },
  { value: "learner", label: "Learner" },
];

export const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(150),
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    role: z.enum(["school", "teacher", "learner"], { errorMap: () => ({ message: "Select a role" }) }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
