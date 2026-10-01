const express = require("express");
const rateLimit = require("express-rate-limit");
const { signup, login, logout, me, recordActivity, updateMe, verifyPassword, changePassword, forgotPassword, checkResetToken, resetPassword, createAdmin } = require("./auth.controller");
const { protect, authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Limit is generous because school/office networks put many real users behind one shared IP —
// skipSuccessfulRequests means only repeated *failures* count, so normal concurrent logins from
// a shared IP never trip it; only sustained credential-guessing does.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

// Asking for a reset email. Counts every request (there's no "successful" one to skip — the
// answer is always the same), so it's roomier than it looks for a shared school network; the
// real per-account cap is in AuthService.requestPasswordReset.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many password reset requests. Please try again later." },
});

// Using a reset link — only failures count, same as loginLimiter, so guessing tokens is capped.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.get("/reset-password/:token", resetPasswordLimiter, checkResetToken);
router.post("/reset-password", resetPasswordLimiter, resetPassword);
router.post("/signup", signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", protect, me);
router.post("/activity", protect, recordActivity);
router.put("/me", protect, updateMe);
router.post("/verify-password", protect, loginLimiter, verifyPassword);
router.patch("/change-password", protect, loginLimiter, changePassword);
// Creates another tenant admin — only an existing admin can do this (there is otherwise no way
// to create a second admin at all; ADMIN_EMAIL/ADMIN_PASSWORD only ever bootstraps the first).
router.post("/admins", protect, authorize("admin"), createAdmin);

module.exports = router;
