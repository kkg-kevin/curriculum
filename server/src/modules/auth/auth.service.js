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
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
