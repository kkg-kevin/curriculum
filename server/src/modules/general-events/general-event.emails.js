// Emails to the people registered for a general event (general-event.service.js) — most aren't
// users of the system, so these go straight to the address they gave, through the email outbox
// (which never throws): their confirmation (or "you're on the waiting list"), a place freed up,
// "in two days" and "today" reminders, the event cancelled, their own cancellation, the team's
// messages (and the thank-you after), and an invitation to a bootcamp's families. Each carries
// the event's details and a button to their own registration page on the website.
const env = require("../../config/env");
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail } = require("../../shared/mail/mail.layout");
const R = require("./general-event.rules");

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const footerNote = "You're getting this because you registered for a Digifunzi event.";

// The website's address (a https one first) — registration pages live there.
function siteBase() {
  const all = String(env.PUBLIC_SITE_URL || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  return env.MAIL_WEBSITE_URL?.replace(/\/+$/, "") || all.find((o) => /^https:\/\//i.test(o)) || all[0] || null;
}
const siteUrl = (path) => (siteBase() ? `${siteBase()}${path}` : null);
const eventUrl = (event) => siteUrl(`/events/${event.slug}`);
const manageUrl = (reg) => siteUrl(`/events/registration/${reg.token}`);

function detailRows(event, reg, { hubName, withLink = false } = {}) {
  const rows = [
    ["When", R.describeWhen(event)],
    ["Where", R.whereText(event, hubName)],
  ];
  if (event.mapUrl && event.format !== "online") rows.push(["Map", event.mapUrl]);
  if (withLink && event.meetingLink && event.format !== "in_person") rows.push(["Join online", event.meetingLink]);
  if (reg) rows.push([reg.status === "waitlisted" ? "Waiting for" : "Places", `${reg.partySize} ${Number(reg.partySize) === 1 ? "person" : "people"}`]);
  return rows;
}

function send(reg, { subject, template, dedupeKey, button, ...content }) {
  if (!reg?.email) return Promise.resolve(null);
  const { html, text } = renderEmail({
    greeting: `Hi ${firstName(reg.name)},`,
    footerNote,
    button: button === undefined ? (manageUrl(reg) ? { label: "View my registration", url: manageUrl(reg) } : undefined) : button,
    ...content,
  });
  return queueMail({ to: reg.email, subject, html, text, template, dedupeKey, userId: reg.userId || undefined });
}

module.exports = {
  siteUrl, eventUrl, manageUrl,

  // Registered or on the waiting list. `again` = they registered before and asked again.
  confirmation(event, reg, { hubName, again = false } = {}) {
    const waiting = reg.status === "waitlisted";
    return send(reg, {
      subject: waiting ? `You're on the waiting list: ${event.title}` : `You're registered: ${event.title}`,
      template: "general_event_registered",
      dedupeKey: again ? `event_again:${reg.id}:${R.kenyaDateOf()}` : `event_registered:${reg.id}:${reg.status}:${reg.updatedAt ? new Date(reg.updatedAt).getTime() : ""}`,
      tone: waiting ? "warning" : "celebrate", icon: waiting ? "refresh" : "check", eyebrow: R.KINDS[event.kind] || "Event",
      heading: waiting ? "You're on the waiting list" : "See you there!",
      highlight: { label: event.title, value: R.describeWhen(event) },
      paragraphs: [
        waiting
          ? "The event is full right now. If a place frees up we'll give it to you in the order people joined the list, and email you straight away."
          : again ? "You're already registered — here are your details again." : `Thanks for registering. We've kept ${Number(reg.partySize) === 1 ? "a place" : `${reg.partySize} places`} for you.`,
      ],
      rows: detailRows(event, reg, { hubName, withLink: !waiting }),
      afterParagraphs: ["Can't make it any more? Please cancel from your registration page so someone else can have your place."],
    });
  },

  promoted(event, reg, { hubName } = {}) {
    return send(reg, {
      subject: `A place opened up: ${event.title}`,
      template: "general_event_promoted",
      dedupeKey: `event_promoted:${reg.id}:${reg.promotedAt ? new Date(reg.promotedAt).getTime() : ""}`,
      tone: "celebrate", icon: "star", eyebrow: R.KINDS[event.kind] || "Event",
      heading: "Good news — you have a place",
      highlight: { label: event.title, value: R.describeWhen(event) },
      paragraphs: ["Someone couldn't make it, so the place is yours. Nothing else to do — just come along."],
      rows: detailRows(event, reg, { hubName, withLink: true }),
    });
  },

  reminder(event, reg, { hubName, when } = {}) {
    const today = when === "today";
    return send(reg, {
      subject: today ? `Today: ${event.title}` : `Coming up: ${event.title}`,
      template: "general_event_reminder",
      dedupeKey: `event_reminder_${today ? "today" : "soon"}:${reg.id}`,
      tone: "info", icon: "home", eyebrow: today ? "Today" : "Reminder",
      heading: today ? "It's today!" : "It's nearly here",
      highlight: { label: event.title, value: R.describeWhen(event) },
      paragraphs: [today
        ? event.format === "online" ? "Join with the link below a few minutes before it starts." : "We're looking forward to seeing you. Give yourself time to find the place."
        : "Just a reminder that you're registered. Let us know if you can't make it any more."],
      rows: detailRows(event, reg, { hubName, withLink: true }),
    });
  },

  eventCancelled(event, reg, { reason } = {}) {
    return send(reg, {
      subject: `Cancelled: ${event.title}`,
      template: "general_event_cancelled",
      dedupeKey: `event_cancelled:${event.id}:${reg.id}`,
      tone: "danger", icon: "cross", eyebrow: "Event cancelled",
      heading: "This event has been cancelled",
      highlight: { label: event.title, value: R.describeWhen(event) },
      paragraphs: [
        reason ? `From our team: ${reason}` : "We're sorry — we've had to cancel this event.",
        "We'll let you know about the next one.",
      ],
      button: siteUrl("/events") ? { label: "See our events", url: siteUrl("/events") } : null,
    });
  },

  youCancelled(event, reg) {
    return send(reg, {
      subject: `Registration cancelled: ${event.title}`,
      template: "general_event_you_cancelled",
      dedupeKey: `event_you_cancelled:${reg.id}:${reg.cancelledAt ? new Date(reg.cancelledAt).getTime() : ""}`,
      tone: "info", icon: "check", eyebrow: R.KINDS[event.kind] || "Event",
      heading: "Your registration is cancelled",
      paragraphs: [`Thanks for letting us know — we've given your place for ${event.title} to someone else. Changed your mind? Register again on the event's page while places last.`],
      button: eventUrl(event) ? { label: "Open the event", url: eventUrl(event) } : null,
    });
  },

  // A message from the team (and the thank-you after) — `key` keeps one send per person.
  message(event, reg, { subject, body, key, hubName }) {
    return send(reg, {
      subject,
      template: "general_event_message",
      dedupeKey: `event_message:${key}:${reg.id}`,
      tone: "brand", icon: "envelope", eyebrow: event.title,
      heading: subject,
      paragraphs: String(body || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      rows: R.eventState(event) === "upcoming" ? detailRows(event, reg, { hubName, withLink: reg.status === "registered" }) : [],
    });
  },

  // An invitation to someone who isn't registered (a bootcamp's families).
  invitation(event, person, { hubName }) {
    const url = eventUrl(event);
    const { html, text } = renderEmail({
      greeting: `Hi ${firstName(person.name)},`,
      footerNote: "You're getting this because your family is part of Digifunzi.",
      tone: "celebrate", icon: "star", eyebrow: "You're invited",
      heading: event.title,
      highlight: { label: R.KINDS[event.kind] || "Event", value: R.describeWhen(event) },
      paragraphs: [event.tagline || "Come and see what our learners have been making.", "It's free — register so we can keep a place for you (and anyone coming with you)."],
      rows: detailRows(event, null, { hubName }),
      button: url ? { label: "Register now", url: `${url}?invited=1` } : undefined,
    });
    return queueMail({ to: person.email, subject: `You're invited: ${event.title}`, html, text, template: "general_event_invitation", dedupeKey: `event_invite:${event.id}:${String(person.email).toLowerCase()}` });
  },
};
