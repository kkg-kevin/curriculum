const asyncHandler = require("express-async-handler");
const AuthService = require("./auth.service");
const { loginSchema, signupSchema, createUserSchema, updateMeSchema, verifyPasswordSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require("./auth.validation");
const { COOKIE_NAME, NODE_ENV } = require("../../config/env");
const jwt = require("jsonwebtoken");
const AuditService = require("../audit/audit.service");

// "lax" cookies aren't sent on cross-site XHR/fetch (only on top-level navigation), which is
// fine locally where client and server share the "localhost" site across ports, but breaks
// silently in production if client and API end up on different registrable domains. "none"
// requires "secure", so it's only safe once NODE_ENV === "production" forces HTTPS.
const baseCookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: NODE_ENV === "production" ? "none" : "lax",
};
// No maxAge/expires: a browser-session cookie, gone when the browser closes, so reopening it
// means signing in again. (Closing just the tab is handled client-side — see
// client/src/context/sessionTabs.js.) The token inside still carries its own JWT_EXPIRES_IN cap.
const cookieOptions = { ...baseCookieOptions };

const signup = asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);
  const user = await AuthService.signup(data);
  res.status(201).json({ success: true, data: user });
});

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);
  let user;
  let token;
  try {
    ({ user, token } = await AuthService.login(identifier, password));
  } catch (err) {
    // A wrong password or unknown account, for the activity log — never the password itself.
    if (err.statusCode === 401) AuditService.recordAuth(req, "login_failed", { identifier, reason: err.message });
    throw err;
  }
  AuditService.recordAuth(req, "login", { user });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ success: true, data: { ...user, session: AuthService.sessionSettings() } });
});

const logout = asyncHandler(async (req, res) => {
  const signedInAs = jwt.decode(req.cookies?.[COOKIE_NAME] || "")?.sub;
  await AuthService.logout(req.cookies?.[COOKIE_NAME]);
  if (signedInAs) AuditService.recordAuth(req, "logout", { user: { id: signedInAs } });
  res.clearCookie(COOKIE_NAME, baseCookieOptions);
  res.json({ success: true });
});

// `session` tells the client how long it may sit idle before signing out (SESSION_IDLE_MINUTES).
const me = asyncHandler(async (req, res) => {
  const user = await AuthService.getById(req.user.id);
  res.json({ success: true, data: { ...user, session: AuthService.sessionSettings() } });
});

// The client's "the user is still here" signal — sent at most about every 30s while someone is
// clicking/typing/scrolling (or has an assessment open). The only thing that keeps a session
// from timing out.
const recordActivity = asyncHandler(async (req, res) => {
  await AuthService.recordActivity(req.sessionJti);
  res.json({ success: true, data: AuthService.sessionSettings() });
});

const updateMe = asyncHandler(async (req, res) => {
  const parsed = updateMeSchema.parse(req.body);
  const data = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
  const user = await AuthService.updateMe(req.user.id, data);
  res.json({ success: true, data: user });
});

const verifyPassword = asyncHandler(async (req, res) => {
  const { password } = verifyPasswordSchema.parse(req.body);
  await AuthService.verifyPassword(req.user.id, password);
  res.json({ success: true });
});

const changePassword = asyncHandler(async (req, res) => {
  const data = changePasswordSchema.parse(req.body);
  const result = await AuthService.changePassword(req.user.id, data);
  res.json({ success: true, data: result });
});

// Always the same answer, sent without waiting for the lookup or the email — neither the reply
// nor how long it takes says whether the email/username belongs to an account.
const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = forgotPasswordSchema.parse(req.body);
  AuthService.requestPasswordReset(identifier).catch((err) => console.error("[auth] password reset request failed:", err.message));
  res.json({ success: true, message: "If that account exists, we've emailed a link to reset its password." });
});

const checkResetToken = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await AuthService.checkResetToken(req.params.token) });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  const result = await AuthService.resetPassword(token, newPassword);
  if (result.userId) AuditService.recordAuth(req, "password_reset", { user: { id: result.userId } });
  res.json({ success: true, data: { message: result.message } });
});

// Admin-only, and deliberately admin-only in effect too: createUserSchema's role field still
// accepts the other USER_ROLES values, but every other role is already created through its own
// dedicated flow (a school/teacher/learner portal login, via AuthService.setOrCreatePassword*)
// tied to the record it belongs to — this route exists specifically so a second (and third, ...)
// tenant admin can be created at all, since ADMIN_EMAIL/ADMIN_PASSWORD only ever bootstraps the
// first one (see server.js's ensureAdmin). Force role to "admin" here rather than trusting the
// body, so this route can never become a second, less-scoped way to create a school/teacher/
// learner login.
const createAdmin = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse({ ...req.body, role: "admin" });
  const user = await AuthService.createUser(data);
  res.status(201).json({ success: true, data: user });
});

module.exports = { signup, login, logout, me, recordActivity, updateMe, verifyPassword, changePassword, forgotPassword, checkResetToken, resetPassword, createAdmin };
