const asyncHandler = require("express-async-handler");
const AuthService = require("./auth.service");
const { loginSchema } = require("./auth.validation");
const { COOKIE_NAME, NODE_ENV } = require("../../config/env");

const cookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { user, token } = await AuthService.login(email, password);
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ success: true, data: user });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: NODE_ENV === "production", sameSite: "lax" });
  res.json({ success: true });
});

const me = asyncHandler(async (req, res) => {
  const user = AuthService.getById(req.user.id);
  res.json({ success: true, data: user });
});

module.exports = { login, logout, me };
