const express = require("express");
const rateLimit = require("express-rate-limit");
const { signup, login, switchRole, logout, me, recordActivity, updateMe, verifyPassword, changePassword, forgotPassword, checkResetToken, resetPassword, createAdmin } = require("./auth.controller");
const { protect, authorize } = require("../../shared/middleware/auth.middleware");
const { initiateForPendingSignup } = require("../payments/mpesa/mpesa.controller");
const { perAccountKey } = require("../../shared/middleware/rate-limit.middleware");

const router = express.Router();

// Failed sign-ins, counted per account (address + the username / email typed — perAccountKey):
// 20 wrong passwords for one account in 15 minutes and that account waits; nobody else does.
// skipSuccessfulRequests means only failures count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: perAccountKey((req) => req.body?.identifier),
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
  keyGenerator: perAccountKey((req) => req.body?.email || req.body?.identifier),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many password reset requests. Please try again later." },
});

// Using a reset link — only failures count, same as loginLimiter, so guessing tokens is capped.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: perAccountKey((req) => req.params?.token || req.body?.token),
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
// Another of the account's roles for this session (see account-roles.js).
router.post("/switch-role", protect, switchRole);
router.get("/me", protect, me);
router.post("/activity", protect, recordActivity);
router.put("/me", protect, updateMe);
router.post("/verify-password", protect, loginLimiter, verifyPassword);
router.patch("/change-password", protect, loginLimiter, changePassword);
// Creates another tenant admin — only an existing admin can do this (there is otherwise no way
// to create a second admin at all; ADMIN_EMAIL/ADMIN_PASSWORD only ever bootstraps the first).
router.post("/admins", protect, authorize("admin"), createAdmin);
// "Pay now" on the payment-pending screen. Here rather than under /api/billing because an account
// waiting on its first payment is refused every other change (blockIfSuspended) — paying is the
// one thing it must be able to do. It can only pay its own sign-up invoice.
router.post("/pending-payment/mpesa", protect, initiateForPendingSignup);

module.exports = router;
