const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("./user.model");
const LearnerModel = require("../learners/learner.model");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../../config/env");

const SALT_ROUNDS = 10;

// Strips the password hash before a user record ever leaves the service layer.
function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

const AuthService = {
  async createUser({ name, email, password, role }) {
    if (UserModel.findByEmail(email)) {
      const err = new Error("A user with this email already exists");
      err.statusCode = 409;
      throw err;
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = UserModel.create({ name, email, passwordHash, role });
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
    const existing = UserModel.findByEmail(email);
    if (existing) {
      if (existing.role !== role) {
        const err = new Error(`This email is already registered as a ${existing.role} account`);
        err.statusCode = 409;
        throw err;
      }
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      return sanitize(UserModel.update(existing.id, { passwordHash }));
    }
    return this.createUser({ name, email, password, role });
  },

  // Mints/resets a learner's OWN dedicated portal login — distinct from setOrCreatePassword
  // above, which is always the GUARDIAN's account. Keyed by username instead of email, and the
  // resulting User row never has an email at all. Same existing-row conflict shape as
  // setOrCreatePassword: reset in place if the role matches, otherwise 409.
  async setOrCreatePasswordByUsername({ name, username, password, role }) {
    const existing = UserModel.findByUsername(username);
    if (existing) {
      if (existing.role !== role) {
        const err = new Error(`This username is already registered as a ${existing.role} account`);
        err.statusCode = 409;
        throw err;
      }
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      return sanitize(UserModel.update(existing.id, { passwordHash }));
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    return sanitize(UserModel.create({ name, username, passwordHash, role }));
  },

  // Keeps a learner's own dedicated login attached to their current username when it's renamed
  // elsewhere (see learner.controller.js's updateLearner) — without this the login would still
  // work but silently become unreachable under the old username. No-ops if there's no dedicated
  // login to move (most learners don't have one) or no new username to move it to.
  async renameUsernameAccount(oldUsername, newUsername) {
    if (!oldUsername || oldUsername === newUsername) return;
    const existing = UserModel.findByUsername(oldUsername);
    if (!existing || !newUsername) return;
    UserModel.update(existing.id, { username: newUsername });
  },

  // `identifier` may be: an account's own email (admin/school/teacher/branchAdmin/curriculumAdmin,
  // or a guardian logging in directly); a learner's own dedicated username (a genuinely separate
  // account/password from the guardian's — see setOrCreatePasswordByUsername); or, for a learner
  // who has a username but no dedicated login yet, that same username resolved the original way —
  // through the learner record it belongs to, then that learner's guardianEmail, then the
  // guardian's own account. `Learner.username` is regex-restricted to exclude "@", so it can never
  // collide with an email-shaped identifier — these three branches are mutually exclusive.
  async login(identifier, password) {
    let user = UserModel.findByEmail(identifier);
    if (!user) user = UserModel.findByUsername(identifier);
    if (!user) {
      const learner = LearnerModel.findByUsername(identifier);
      if (learner?.guardianEmail) user = UserModel.findByEmail(learner.guardianEmail);
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
    const token = signToken(user);
    return { user: sanitize(user), token };
  },

  getById(id) {
    const user = UserModel.findById(id);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }
    return sanitize(user);
  },

  updateMe(id, data) {
    const user = UserModel.update(id, data);
    if (!user) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }
    return sanitize(user);
  },
};

module.exports = AuthService;
