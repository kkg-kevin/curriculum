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

module.exports = { protect, authorize };
