const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("./user.model");
const LearnerModel = require("../learners/learner.model");
const TeacherModel = require("../teachers/teacher.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const LeadModel = require("../leads/lead.model");
const BootcampModel = require("../bootcamps/bootcamp.model");
const RevokedTokenModel = require("./revoked-token.model");
const { resolveEffectiveBootcampPrice } = require("../../shared/utils/bootcamp-pricing");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../../config/env");

const SALT_ROUNDS = 10;

// Strips the password hash before a user record ever leaves the service layer.
function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// Resolves whether a user's account is suspended (deactivated), and why. A suspended user is
// still allowed a session — they can log in and load /api/auth/me — but the client locks them
// to an in-app "Account Suspended" page, and every write is refused server-side by the
// blockIfSuspended middleware. Returns null (not suspended) or a reason string:
//   "hub"     — the school-role account's own learning hub is inactive
//   "teacher" — the teacher record is inactive ("on_leave" is NOT a suspension, just a hint)
//   "learner" — the learner account (or every sibling under a guardian login) is inactive
//   "payment" — the learner account (or every sibling) is "pending_payment" — auto-provisioned
//               from a public bootcamp enrollment (see bootcamp-enrollment.service.js) and not
//               yet marked paid. Kept distinct from "learner" so the client can show "please
//               complete payment" instead of "contact your school administrator", which would
//               be actively wrong for this case.
// A user with no matching record at all (e.g. a teacher login with no teacher row yet) is not
// suspended — that's handled by the portals' own "no profile linked" states.
function learnerSuspensionReason(learners) {
  if (learners.some((l) => (l.accountStatus || "active") === "active")) return null;
  // None are active — "payment" takes priority over the generic "learner" reason whenever at
  // least one sibling is pending_payment rather than a hard "inactive", since that's the more
  // actionable, specific thing to tell them.
  return learners.some((l) => l.accountStatus === "pending_payment") ? "payment" : "learner";
}

async function resolveSuspension(user) {
  if (!user) return null;

  if (user.role === "school") {
    const hubs = await LearningHubModel.findAll({ email: user.email, includeDrafts: true });
    const ownHub = hubs.find((h) => !h.parentHubId) || hubs[0] || null;
    if (ownHub && ownHub.status === "inactive") return "hub";
  }

  if (user.role === "teacher") {
    const teachers = await TeacherModel.findAll({ email: user.email });
    if (teachers.length > 0 && !teachers.some((t) => (t.status || "active") !== "inactive")) return "teacher";
  }

  if (user.role === "learner") {
    if (user.username) {
      const learner = await LearnerModel.findByUsername(user.username);
      if (!learner) return "learner";
      return learnerSuspensionReason([learner]);
    }
    const learners = await LearnerModel.findAll({ guardianEmail: user.email });
    if (learners.length === 0) return "learner";
    return learnerSuspensionReason(learners);
  }

  return null;
}

// Kept for the one caller that must still hard-fail on a missing user (protect's getById path).
async function assertUserExists(user) {
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  return user;
}

// jti gives each issued token a unique identity to revoke by (see logout below) — without it,
// the denylist would have nothing to key a single token's revocation on short of storing the
// whole raw token string.
function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, username: user.username, jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

const AuthService = {
  async createUser({ name, email, password, role }) {
    if (await UserModel.findByEmail(email)) {
      const err = new Error("A user with this email already exists");
      err.statusCode = 409;
      throw err;
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({ name, email, passwordHash, role });
    return sanitize(user);
  },

  // Public self-signup — role is already restricted to non-admin values by signupSchema,
  // but createUser is the single write path either way. Does not sign a token: the account
  // is created but the user still has to log in separately, same as any other account.
  async signup({ name, email, password, role }) {
    return this.createUser({ name, email, password, role });
  },

  // Used by learning-hub.controller.js when an admin sets/resets a school-type learning hub's
  // portal password from the learning hub form itself. If an account with that email already exists, its
  // password is reset (only when the role matches — never silently repurpose an unrelated
  // admin/teacher/learner account onto a new role by reusing their email). Otherwise a fresh
  // account is created, same as self-signup.
  async setOrCreatePassword({ name, email, password, role }) {
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      if (existing.role !== role) {
        const err = new Error(`This email is already registered as a ${existing.role} account`);
        err.statusCode = 409;
        throw err;
      }
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      return sanitize(await UserModel.update(existing.id, { passwordHash }));
    }
    return this.createUser({ name, email, password, role });
  },

  // Mints/resets a learner's OWN dedicated portal login — distinct from setOrCreatePassword
  // above, which is always the GUARDIAN's account. Keyed by username instead of email, and the
  // resulting User row never has an email at all. Same existing-row conflict shape as
  // setOrCreatePassword: reset in place if the role matches, otherwise 409.
  async setOrCreatePasswordByUsername({ name, username, password, role }) {
    const existing = await UserModel.findByUsername(username);
    if (existing) {
      if (existing.role !== role) {
        const err = new Error(`This username is already registered as a ${existing.role} account`);
        err.statusCode = 409;
        throw err;
      }
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      return sanitize(await UserModel.update(existing.id, { passwordHash }));
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    return sanitize(await UserModel.create({ name, username, passwordHash, role }));
  },

  // Keeps a learner's own dedicated login attached to their current username when it's renamed
  // elsewhere (see learner.controller.js's updateLearner) — without this the login would still
  // work but silently become unreachable under the old username. No-ops if there's no dedicated
  // login to move (most learners don't have one) or no new username to move it to.
  async renameUsernameAccount(oldUsername, newUsername) {
    if (!oldUsername || oldUsername === newUsername) return;
    const existing = await UserModel.findByUsername(oldUsername);
    if (!existing || !newUsername) return;
    await UserModel.update(existing.id, { username: newUsername });
  },

  // `identifier` may be: an account's own email (admin/school/teacher/curriculumAdmin,
  // or a guardian logging in directly); a learner's own dedicated username (a genuinely separate
  // account/password from the guardian's — see setOrCreatePasswordByUsername); or, for a learner
  // who has a username but no dedicated login yet, that same username resolved the original way —
  // through the learner record it belongs to, then that learner's guardianEmail, then the
  // guardian's own account. `Learner.username` is regex-restricted to exclude "@", so it can never
  // collide with an email-shaped identifier — these three branches are mutually exclusive.
  async login(identifier, password) {
    let user = await UserModel.findByEmail(identifier);
    if (!user) user = await UserModel.findByUsername(identifier);
    if (!user) {
      const learner = await LearnerModel.findByUsername(identifier);
      if (learner?.guardianEmail) user = await UserModel.findByEmail(learner.guardianEmail);
    }
    if (!user) {
      const err = new Error("Invalid email/username or password");
      err.statusCode = 401;
      throw err;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const err = new Error("Invalid email/username or password");
      err.statusCode = 401;
      throw err;
    }
    // A suspended account is still allowed to log in — the client shows an in-app "Account
    // Suspended" page and every write is refused server-side. `suspended` rides along on the
    // returned user so the client knows immediately, without a second round trip.
    const suspended = await resolveSuspension(user);
    const pendingPayment = suspended === "payment" ? await this.getPendingPayment(user) : null;
    const token = signToken(user);
    return { user: { ...sanitize(user), suspended, pendingPayment }, token };
  },

  // Confirms the CURRENTLY logged-in user really knows their own password, without touching
  // their session (no new token/cookie) — used by the learner-portal's sibling switcher to
  // re-gate a guardian-mediated session before it flips to a different linked learner, since
  // the switch itself is invisible to the server (same JWT either way).
  async verifyPassword(id, password) {
    const user = await UserModel.findById(id);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const err = new Error("Incorrect password");
      err.statusCode = 401;
      throw err;
    }
    return true;
  },

  // Self-service password change — any authenticated role. Routed through auth.routes.js, which
  // (like every route in that file) uses the bare `protect` exported by auth.middleware.js, not
  // app.js's own protect = [protectBase, blockIfSuspended] — so this is reachable even for a
  // suspended/pending-payment account, same as /me and /verify-password already are. That's the
  // right behavior here: being able to set a real password for yourself shouldn't require your
  // account to be unsuspended first.
  async changePassword(id, { currentPassword, newPassword }) {
    const user = await UserModel.findById(id);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      const err = new Error("Current password is incorrect");
      err.statusCode = 401;
      throw err;
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await UserModel.update(id, { passwordHash });
    return { message: "Password changed successfully" };
  },

  // The JWT design has no server-side session to invalidate on its own — jwt.verify() alone
  // considers any correctly-signed, unexpired token valid regardless of whether its owner has
  // since logged out. This records the current token's jti in the denylist protect() checks on
  // every request, so a copied/stolen cookie stops working immediately at logout instead of
  // silently remaining valid until its natural expiry. Verifies the signature (ignoring
  // expiration, since revoking an already-expired token is a harmless no-op) rather than just
  // decoding it, so a malformed or forged token can't be used to plant an arbitrary jti here.
  async logout(token) {
    if (!token) return;
    try {
      const payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
      if (payload?.jti && payload?.exp) {
        await RevokedTokenModel.create({ jti: payload.jti, userId: payload.sub, expiresAt: new Date(payload.exp * 1000) });
      }
    } catch {
      // Not a token we issued — nothing valid to revoke.
    }
    await RevokedTokenModel.pruneExpired();
  },

  async getById(id) {
    const user = await UserModel.findById(id);
    await assertUserExists(user);
    // A suspended user still gets a valid /me response — the client uses `suspended` to lock
    // them to the in-app "Account Suspended" page.
    const suspended = await resolveSuspension(user);
    const pendingPayment = suspended === "payment" ? await this.getPendingPayment(user) : null;
    return { ...sanitize(user), suspended, pendingPayment };
  },

  // "What do I owe" for the "payment pending" screen — a learner auto-provisioned from a public
  // bootcamp enrollment (see bootcamp-enrollment.service.js) has a `leads` row linking them to
  // the bootcamp + hub they signed up for; this resolves that lead's bootcamp price and hub name
  // so the price shown at signup is still visible on every later login, not just the one-time
  // confirmation screen. Returns null (not an error) whenever there's nothing to show — a
  // non-learner account, a learner with no such lead (e.g. enrolled the normal admin way), or
  // one that's already fully paid — the client only renders this on the "payment" suspension
  // screen, where a null just means "no price on file, ask the hub."
  async getPendingPayment(user) {
    if (!user || user.role !== "learner") return null;
    // Same learner-resolution as resolveSuspension: a dedicated login resolves directly, a
    // guardian-mediated login resolves to whichever child that account's own email currently
    // scopes to (checked by resolveSuspension before this is ever reached, so a mixed-sibling
    // guardian account only gets here for the specific reason: "payment").
    let learnerId = null;
    if (user.username) {
      const learner = await LearnerModel.findByUsername(user.username);
      learnerId = learner?.id || null;
    } else {
      const learners = await LearnerModel.findAll({ guardianEmail: user.email });
      const pending = learners.find((l) => l.accountStatus === "pending_payment");
      learnerId = (pending || learners[0])?.id || null;
    }
    if (!learnerId) return null;

    const lead = await LeadModel.findByLearnerId(learnerId);
    if (!lead || lead.paidAt || !lead.bootcampId) return null;

    const bootcamp = await BootcampModel.findById(lead.bootcampId);
    if (!bootcamp) return null;

    let hubName = null;
    if (lead.hubId) {
      const hub = await LearningHubModel.findById(lead.hubId);
      hubName = hub?.name || null;
    }

    const price = resolveEffectiveBootcampPrice(bootcamp);
    return {
      bootcampName: bootcamp.name,
      amount: price.amount,
      currency: price.currency,
      mode: price.mode,
      hubName,
    };
  },

  async updateMe(id, data) {
    const current = await UserModel.findById(id);
    await assertUserExists(current);
    // A suspended user can't edit their own profile either — this is a write.
    if (await resolveSuspension(current)) {
      const err = new Error("Your account is suspended.");
      err.statusCode = 403;
      err.code = "ACCOUNT_SUSPENDED";
      throw err;
    }
    const user = await UserModel.update(id, data);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }
    return sanitize(user);
  },

  // Exposed so middleware (blockIfSuspended) can reuse the exact same resolution.
  resolveSuspension,
};

module.exports = AuthService;
