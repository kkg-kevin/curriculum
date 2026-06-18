const { NODE_ENV } = require("../../config/env");

const logger = {
  info: (...args) => {
    if (NODE_ENV !== "test") console.log("[INFO]", ...args);
  },
  error: (...args) => {
    console.error("[ERROR]", ...args);
  },
  warn: (...args) => {
    console.warn("[WARN]", ...args);
  },
};

module.exports = logger;
