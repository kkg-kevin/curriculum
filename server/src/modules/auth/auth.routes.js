const express = require("express");
const rateLimit = require("express-rate-limit");
const { signup, login, logout, me, updateMe, verifyPassword, createAdmin } = require("./auth.controller");
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

router.post("/signup", signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", protect, me);
router.put("/me", protect, updateMe);
router.post("/verify-password", protect, loginLimiter, verifyPassword);
// Creates another tenant admin — only an existing admin can do this (there is otherwise no way
// to create a second admin at all; ADMIN_EMAIL/ADMIN_PASSWORD only ever bootstraps the first).
router.post("/admins", protect, authorize("admin"), createAdmin);

module.exports = router;
