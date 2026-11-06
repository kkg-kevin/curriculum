// Emails to affiliates who aren't users of the system (no login — so no bell): their application
// arrived, they're approved (with their link and private dashboard), a family signed up through
// them, they earned, a payout was paid or not. Every one carries their dashboard link
// (affiliate.service.js's dashboardUrl). Sent through the email outbox, which never throws.
// Affiliates with a login get bell notifications instead (affiliate.service.js).
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail } = require("../../shared/mail/mail.layout");

const ksh = (n) => `KSh ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const footerNote = "You're getting this because you're a Digifunzi affiliate.";

function send(affiliate, { subject, dedupeKey, template, ...content }) {
  if (!affiliate?.email) return Promise.resolve(null);
  const { html, text } = renderEmail({ greeting: `Hi ${firstName(affiliate.name)},`, footerNote, ...content });
  return queueMail({ to: affiliate.email, subject, html, text, template, dedupeKey });
}

const dashboardButton = (url) => (url ? { label: "Open your dashboard", url } : undefined);

module.exports = {
  applicationReceived(affiliate) {
    return send(affiliate, {
      subject: "We've got your affiliate application",
      template: "affiliate_application",
      dedupeKey: `affiliate_application:${affiliate.id}`,
      tone: "info", icon: "envelope", eyebrow: "Affiliate application",
      heading: "Thanks for applying",
      paragraphs: [
        "We've received your application to become a Digifunzi affiliate. Our team will look at it and email you once you're approved — with your own link, your code and your dashboard.",
      ],
    });
  },

  welcome(affiliate, { link, dashboardUrl, offer }) {
    return send(affiliate, {
      subject: "You're a Digifunzi affiliate — here's your link",
      template: "affiliate_welcome",
      dedupeKey: `affiliate_welcome:${affiliate.id}`,
      tone: "celebrate", icon: "star", eyebrow: "Welcome",
      heading: "You're in",
      highlight: { label: "Your code", value: affiliate.code, note: link || undefined },
      paragraphs: [
        offer ? `You earn ${offer}.` : "You earn when the families you refer pay.",
        "Share your link — or ask families to type your code when they sign up. Your dashboard shows who signed up through you, what you've earned and your payouts. Keep its link to yourself: anyone with it can see your dashboard.",
      ],
      button: dashboardButton(dashboardUrl),
    });
  },

  dashboardLink(affiliate, { dashboardUrl }) {
    return send(affiliate, {
      subject: "Your Digifunzi affiliate dashboard",
      template: "affiliate_dashboard_link",
      tone: "brand", icon: "envelope", eyebrow: "Your dashboard",
      heading: "Your dashboard link",
      paragraphs: [
        "Here's the link to your affiliate dashboard: your referrals, what you've earned and your payouts. Keep it to yourself — any earlier link no longer works if we've made you a new one.",
      ],
      button: dashboardButton(dashboardUrl),
    });
  },

  referral(affiliate, { referral, programme, dashboardUrl }) {
    return send(affiliate, {
      subject: "A family signed up through you",
      template: "affiliate_referral",
      dedupeKey: `affiliate_referral_email:${referral.id}`,
      tone: "info", icon: "check", eyebrow: "New referral",
      heading: `${firstName(referral.customerName)} signed up for ${programme}`,
      paragraphs: ["Thank you for sending them our way. You earn as soon as they pay."],
      button: dashboardButton(dashboardUrl),
    });
  },

  commission(affiliate, { commission, referral, programme, dashboardUrl }) {
    return send(affiliate, {
      subject: `You earned ${ksh(commission.amount)}`,
      template: "affiliate_commission",
      dedupeKey: `affiliate_commission_email:${commission.id}`,
      tone: "success", icon: "star", eyebrow: "Commission",
      heading: "You earned a commission",
      highlight: { label: "Earned", value: ksh(commission.amount), note: `Can be paid out from ${new Date(commission.availableAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` },
      paragraphs: [`${firstName(referral.customerName)}'s family paid for ${programme}.`],
      button: dashboardButton(dashboardUrl),
    });
  },

  payoutPaid(affiliate, { payout, how, dashboardUrl }) {
    return send(affiliate, {
      subject: `Your payout of ${ksh(payout.amount)} is paid`,
      template: "affiliate_payout_paid",
      dedupeKey: `affiliate_payout_paid_email:${payout.id}`,
      tone: "success", icon: "check", eyebrow: "Payout",
      heading: "Your payout is on its way",
      highlight: { label: "Paid", value: ksh(payout.amount), note: how },
      paragraphs: ["Thank you for referring families to Digifunzi."],
      button: dashboardButton(dashboardUrl),
    });
  },

  payoutRejected(affiliate, { payout, note, dashboardUrl }) {
    return send(affiliate, {
      subject: "About your payout request",
      template: "affiliate_payout_rejected",
      dedupeKey: `affiliate_payout_rejected_email:${payout.id}`,
      tone: "warning", icon: "alert", eyebrow: "Payout",
      heading: `We couldn't pay ${ksh(payout.amount)} yet`,
      paragraphs: [
        note ? `Our team's note: ${note}` : "Our team couldn't pay this request.",
        "The amount is still yours — it's available again on your dashboard. Reply to this email if anything needs changing.",
      ],
      button: dashboardButton(dashboardUrl),
    });
  },
};
