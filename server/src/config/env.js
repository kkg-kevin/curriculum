module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  COOKIE_NAME: "token",
  // Mirrors client/src/config/authConfig.js — flip both back to true together to
  // re-enable login enforcement. While false, `protect` lets every request through.
  AUTH_ENABLED: false,
};
