const asyncHandler = require("express-async-handler");
const AuthService = require("./auth.service");
const { loginSchema, signupSchema, updateMeSchema } = require("./auth.validation");
const { COOKIE_NAME, NODE_ENV } = require("../../config/env");

// "lax" cookies aren't sent on cross-site XHR/fetch (only on top-level navigation), which is
// fine locally where client and server share the "localhost" site across ports, but breaks
// silently in production if client and API end up on different registrable domains. "none"
// requires "secure", so it's only safe once NODE_ENV === "production" forces HTTPS.
const baseCookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: NODE_ENV === "production" ? "none" : "lax",
};
const cookieOptions = {
  ...baseCookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const signup = asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);
  const user = await AuthService.signup(data);
  res.status(201).json({ success: true, data: user });
});

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);
  const { user, token } = await AuthService.login(identifier, password);
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ success: true, data: user });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, baseCookieOptions);
  res.json({ success: true });
});

const me = asyncHandler(async (req, res) => {
  const user = await AuthService.getById(req.user.id);
  res.json({ success: true, data: user });
});

const updateMe = asyncHandler(async (req, res) => {
  const parsed = updateMeSchema.parse(req.body);
  const data = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
  const user = await AuthService.updateMe(req.user.id, data);
  res.json({ success: true, data: user });
});

module.exports = { signup, login, logout, me, updateMe };
