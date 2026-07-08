const express = require("express");
const { signup, login, logout, me } = require("./auth.controller");
const { protect } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, me);

module.exports = router;
