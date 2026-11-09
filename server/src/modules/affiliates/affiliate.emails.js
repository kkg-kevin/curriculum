// Emails to affiliates who sign in as Affiliate (not a parent or educator here — affiliate.service.js's
// signsInAsAffiliate): their application arrived; welcome, with how to sign in to their account (a
// one-time "set your password" link when the login was just made for them); sign-in details again
// (staff's button); and, when the workspace sends them (Settings), a family signed up, they earned,
// a payout was paid or not — each with a button to their account. Parents and educators get the
// bell only. Sent through the email outbox, which never throws.
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail } = require("../../shared/mail/mail.layout");

const ksh = (n) => `KSh ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const day = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const footerNote = "You're getting this because you're a Digifunzi affiliate.";

function send(affiliate, { subject, dedupeKey, template, sensitive, expiresAt, ...content }) {
  if (!affiliate?.email) return Promise.resolve(null);
  const { html, text } = renderEmail({ greeting: `Hi ${firstName(affiliate.name)},`, footerNote, ...content });
  return queueMail({ to: affiliate.email, subject, html, text, template, dedupeKey, userId: affiliate.userId || undefined, sensitive, expiresAt });
}

const accountButton = (url) => (url ? { label: "Open your account", url } : undefined);

// How to sign in, for the welcome and sign-in details emails. `account` from affiliate.service.js's
// signInFor: { email, signInUrl, setPasswordUrl?, setPasswordExpiresAt? }.
function signInParts(account) {
  if (account.setPasswordUrl) {
    return {
      text: `Your Digifunzi account is ready: you sign in with this email address (${account.email}). Set your password first — the link below works once, until ${day(account.setPasswordExpiresAt)}. After that, sign in any time at ${account.signInUrl}.`,
      button: { label: "Set your password", url: account.setPasswordUrl },
      after: "Your account shows who signed up through you, what you've earned and your payouts, and it's where you ask to be paid. Link expired? Use \"Forgot password?\" on the sign-in page.",
    };
  }
  return {
    text: `Sign in to your Digifunzi account with this email address (${account.email}) and your usual password, and choose Affiliate if you're asked how you want to sign in.`,
    button: { label: "Sign in", url: account.signInUrl },
    after: "Your account shows who signed up through you, what you've earned and your payouts, and it's where you ask to be paid.",
  };
}

module.exports = {
  applicationReceived(affiliate) {
    return send(affiliate, {
      subject: "We've got your affiliate application",
      template: "affiliate_application",
      dedupeKey: `affiliate_application:${affiliate.id}`,
      tone: "info", icon: "envelope", eyebrow: "Affiliate application",
      heading: "Thanks for applying",
      paragraphs: [
        "We've received your application to become a Digifunzi affiliate. Our team will look at it and email you once you're approved — with your own link, your code and how to sign in to your account.",
      ],
    });
  },

  // Once per affiliate per login (a new login after an email change gets its own).
  welcome(affiliate, { link, offer, account }) {
    const signIn = signInParts(account);
    return send(affiliate, {
      subject: "You're a Digifunzi affiliate — here's your link",
      template: "affiliate_welcome",
      dedupeKey: `affiliate_welcome:${affiliate.id}:${affiliate.userId}`,
      sensitive: Boolean(account.setPasswordUrl), expiresAt: account.setPasswordExpiresAt || undefined,
      tone: "celebrate", icon: "star", eyebrow: "Welcome",
      heading: "You're in",
      highlight: { label: "Your code", value: affiliate.code, note: link || undefined },
      paragraphs: [
        offer ? `You earn ${offer}.` : "You earn when the families you refer pay.",
        "Share your link — or ask families to type your code when they sign up.",
        signIn.text,
      ],
      button: signIn.button,
      afterParagraphs: [signIn.after],
    });
  },

  signInDetails(affiliate, { account }) {
    const signIn = signInParts(account);
    return send(affiliate, {
      subject: "Signing in to your Digifunzi affiliate account",
      template: "affiliate_sign_in",
      sensitive: Boolean(account.setPasswordUrl), expiresAt: account.setPasswordExpiresAt || undefined,
      tone: "brand", icon: "envelope", eyebrow: "Your account",
      heading: "How to sign in",
      paragraphs: [signIn.text],
      button: signIn.button,
      afterParagraphs: [signIn.after, "If you didn't expect this email, you can ignore it — nothing changes until the link is used."],
    });
  },

  referral(affiliate, { referral, programme, accountUrl }) {
    return send(affiliate, {
      subject: "A family signed up through you",
      template: "affiliate_referral",
      dedupeKey: `affiliate_referral_email:${referral.id}`,
      tone: "info", icon: "check", eyebrow: "New referral",
      heading: `${firstName(referral.customerName)} signed up for ${programme}`,
      paragraphs: ["Thank you for sending them our way. You earn as soon as they pay."],
      button: accountButton(accountUrl),
    });
  },

  commission(affiliate, { commission, referral, programme, accountUrl }) {
    return send(affiliate, {
      subject: `You earned ${ksh(commission.amount)}`,
      template: "affiliate_commission",
      dedupeKey: `affiliate_commission_email:${commission.id}`,
      tone: "success", icon: "star", eyebrow: "Commission",
      heading: "You earned a commission",
      highlight: { label: "Earned", value: ksh(commission.amount), note: `Can be paid out from ${day(commission.availableAt)}` },
      paragraphs: [`${firstName(referral.customerName)}'s family paid for ${programme}.`],
      button: accountButton(accountUrl),
    });
  },

  payoutPaid(affiliate, { payout, how, accountUrl }) {
    return send(affiliate, {
      subject: `Your payout of ${ksh(payout.amount)} is paid`,
      template: "affiliate_payout_paid",
      dedupeKey: `affiliate_payout_paid_email:${payout.id}`,
      tone: "success", icon: "check", eyebrow: "Payout",
      heading: "Your payout is on its way",
      highlight: { label: "Paid", value: ksh(payout.amount), note: how },
      paragraphs: ["Thank you for referring families to Digifunzi."],
      button: accountButton(accountUrl),
    });
  },

  payoutRejected(affiliate, { payout, note, accountUrl }) {
    return send(affiliate, {
      subject: "About your payout request",
      template: "affiliate_payout_rejected",
      dedupeKey: `affiliate_payout_rejected_email:${payout.id}`,
      tone: "warning", icon: "alert", eyebrow: "Payout",
      heading: `We couldn't pay ${ksh(payout.amount)} yet`,
      paragraphs: [
        note ? `Our team's note: ${note}` : "Our team couldn't pay this request.",
        "The amount is still yours — it's available again in your account. Reply to this email if anything needs changing.",
      ],
      button: accountButton(accountUrl),
    });
  },
};
