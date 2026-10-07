// Account emails: the password-reset link and the "your password was changed" notice. Both go
// through the email outbox (shared/mail/mail.service.js), which never throws.
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail, appUrl } = require("../../shared/mail/mail.layout");
const { MAIL_BRAND_NAME, PASSWORD_RESET_MINUTES } = require("../../config/env");

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

function validFor() {
  if (PASSWORD_RESET_MINUTES % 60 === 0) {
    const hours = PASSWORD_RESET_MINUTES / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${PASSWORD_RESET_MINUTES} minutes`;
}

// `target` comes from auth.service.js's resolveResetTarget:
//   { user, to, recipientName, childName? }
// childName is set when the link is for a child's own username login and is being sent to their
// parent/guardian, who is the one with an email address.
function sendPasswordResetEmail(target, token, expiresAt) {
  const { user, to, recipientName, childName } = target;
  const paragraphs = childName
    ? [
        `We received a request to reset the password for ${childName}'s learner login (username: ${user.username}). You're receiving this as their parent or guardian.`,
        `Use the button below to choose a new password for ${childName}. The link is valid for ${validFor()} and can be used once.`,
      ]
    : [
        `We received a request to reset the password for your ${MAIL_BRAND_NAME} account.`,
        `Use the button below to choose a new password. The link is valid for ${validFor()} and can be used once.`,
      ];
  const { html, text } = renderEmail({
    tone: "info", icon: "refresh", eyebrow: "Account security",
    preview: `Choose a new password — the link is valid for ${validFor()}.`,
    heading: "Reset your password",
    greeting: `Hi ${firstName(recipientName)},`,
    paragraphs,
    button: { label: "Choose a new password", url: appUrl(`/reset-password?token=${token}`) },
    afterParagraphs: ["If you didn't ask for this, you can ignore this email — the password stays as it is."],
  });
  return queueMail({
    to, subject: `Reset your ${MAIL_BRAND_NAME} password`, html, text,
    template: "password_reset", userId: user.id, sensitive: true, expiresAt,
  });
}

function sendPasswordChangedEmail(target) {
  const { user, to, recipientName, childName } = target;
  const whose = childName ? `The password for ${childName}'s learner login (username: ${user.username})` : `The password for your ${MAIL_BRAND_NAME} account`;
  const { html, text } = renderEmail({
    tone: "warning", icon: "alert", eyebrow: "Account security",
    preview: "If this wasn't you, reset your password straight away.",
    heading: "Your password was changed",
    greeting: `Hi ${firstName(recipientName)},`,
    paragraphs: [
      `${whose} was just changed.`,
      "If that was you, there's nothing more to do.",
      "If it wasn't, reset the password straight away using \"Forgot password?\" on the sign-in page, and let your administrator know.",
    ],
    button: { label: "Go to sign in", url: appUrl("/login") },
  });
  return queueMail({
    to, subject: `Your ${MAIL_BRAND_NAME} password was changed`, html, text,
    template: "password_changed", userId: user.id,
  });
}

module.exports = { sendPasswordResetEmail, sendPasswordChangedEmail };
