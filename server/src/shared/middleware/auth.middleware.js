const jwt = require("jsonwebtoken");
const { JWT_SECRET, COOKIE_NAME, AUTH_ENABLED } = require("../../config/env");
const RevokedTokenModel = require("../../modules/auth/revoked-token.model");
const AuthService = require("../../modules/auth/auth.service");

// Verifies the JWT cookie, confirms the account is still active, and attaches { id, role } to
// req.user. The current-account check makes learner deactivation effective for existing tokens,
// not only for new logins after the token naturally expires.
//
// The signature/expiry check alone can't see that a token's owner has since logged out (a JWT
// is valid purely by being correctly signed and unexpired) — the jti lookup below is what makes
// logout actually take effect immediately instead of leaving a copied/stolen cookie usable until
// it naturally expires. See AuthService.logout, which is what populates this denylist.
async function protect(req, res, next) {
  if (!AUTH_ENABLED) {
    req.user = { id: "dormant-auth", role: "admin", email: "dormant@local" };
    return next();
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    const err = new Error("Not authenticated");
    err.statusCode = 401;
    return next(err);
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.jti && (await RevokedTokenModel.isRevoked(payload.jti))) {
      const err = new Error("Invalid or expired session");
      err.statusCode = 401;
      return next(err);
    }
    const user = await AuthService.getById(payload.sub);
    req.user = { id: user.id, role: user.role, email: user.email, username: user.username };
    next();
  } catch (err) {
    if (err.statusCode === 403 || err.statusCode === 404) return next(err);
    const sessionError = new Error("Invalid or expired session");
    sessionError.statusCode = 401;
    next(sessionError);
  }
}

// Usage: router.use(protect, authorize("admin"))  — call after protect, since it reads req.user.
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      const err = new Error("You do not have permission to perform this action");
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
}

// A suspended account keeps a read-only session (so the client can render its in-app "Account
// Suspended" page) but must not be able to change any data. Mounted once, after `protect`, on
// the whole /api tree: safe methods pass straight through; any mutating request from a suspended
// user is refused with a machine-readable 403. admin/curriculumAdmin can't be suspended, so
// resolveSuspension short-circuits to null for them with no DB work.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function blockIfSuspended(req, res, next) {
  if (SAFE_METHODS.has(req.method) || !AUTH_ENABLED) return next();
  try {
    const reason = await AuthService.resolveSuspension({
      id: req.user.id,
      role: req.user.role,
      email: req.user.email,
      username: req.user.username,
    });
    if (reason) {
      const err = new Error("Your account is suspended — you can view your data but can't make changes.");
      err.statusCode = 403;
      err.code = "ACCOUNT_SUSPENDED";
      err.reason = reason;
      return next(err);
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { protect, authorize, blockIfSuspended };
