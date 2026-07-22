const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("./user.model");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../../config/env");

const SALT_ROUNDS = 10;

// Strips the password hash before a user record ever leaves the service layer.
function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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

  async login(email, password) {
    const user = UserModel.findByEmail(email);
    if (!user) {
      const err = new Error("Invalid email or password");
      err.statusCode = 401;
      throw err;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const err = new Error("Invalid email or password");
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
};

module.exports = AuthService;
