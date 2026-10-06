const express = require("express");
const rateLimit = require("express-rate-limit");
const { getEmailPreferencesByToken, updateEmailPreferencesByToken, getWorkspaceEmails, updateWorkspaceEmails } = require("./notification.controller");

// Which emails the whole workspace sends (Settings → Emails). Owner only — see app.js.
const workspaceRouter = express.Router();
workspaceRouter.route("/").get(getWorkspaceEmails).put(updateWorkspaceEmails);

// Unauthenticated by design — the "choose which emails you get" link in an email's footer, for
// someone who isn't signed in. The token in the link is tied to one account and opens nothing
// but that account's email preferences (see email-workspace.js's preferencesToken).
const publicRouter = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});
publicRouter.route("/email-preferences/:token").get(limiter, getEmailPreferencesByToken).put(limiter, updateEmailPreferencesByToken);

module.exports = { workspaceRouter, publicRouter };
