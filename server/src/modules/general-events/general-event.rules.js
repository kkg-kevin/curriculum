// General events — the rules, with no database (tested in test/general-events.test.js).
//
// An event's date and times are Kenyan calendar dates and "HH:MM" Kenyan times (no time zone to
// get wrong in forms). Capacity counts PEOPLE: a registration of a parent bringing two children is
// a partySize of 3. When the event is full a new registration goes on the waiting list (if the
// event keeps one), and a place freed by a cancellation goes to the waiting list in order.

const KENYA_OFFSET_MS = 3 * 3600 * 1000;
const DAY_MS = 86400000;

const KINDS = {
  showcase: "Showcase",
  open_day: "Open day",
  workshop: "Workshop",
  talk: "Talk",
  other: "Event",
};
const FORMATS = { in_person: "In person", online: "Online", hybrid: "In person and online" };
const STATUSES = ["draft", "published", "cancelled"];

// "About you" — the optional second step. Keys are stored; labels are what people see.
const PERSON_TYPES = {
  parent: "A parent or guardian",
  school: "From a school",
  educator: "An educator",
  student: "A student",
  other: "Something else",
};
const INTERESTS = {
  bootcamps: "Holiday bootcamps",
  home_learning: "Home Learning",
  tech_clubs: "Estate Tech Clubs",
  pathways: "Learning pathways",
  competitions: "Competitions",
  schools: "Digifunzi in my school",
  store: "Kits and robots (Store)",
};
const HEARD_FROM = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google search",
  friend: "A friend or family",
  school: "My child's school",
  poster: "A poster or flyer",
  digifunzi: "I'm already with Digifunzi",
  other: "Somewhere else",
};

// Who sees the sign-in pop-up — each login falls into one group (audienceGroupOf).
const AUDIENCE_GROUPS = {
  parents: "Parents",
  learners: "Learners (children's own logins)",
  educators: "Educators",
  hubs: "Learning hubs",
  staff: "Admins and staff",
  supervisors: "Supervisors",
  affiliates: "Affiliates",
};

// The enquiry's "interested in" (leads.interestedIn) for the first programme they ticked.
const LEAD_INTEREST = { bootcamps: "bootcamp", home_learning: "home_schooling", tech_clubs: "tech_club", store: "project" };

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
const dateOnly = (d) => (d instanceof Date ? kenyaDateOf(d) : String(d || "").slice(0, 10));

function kenyaDateOf(date = new Date()) {
  return new Date(new Date(date).getTime() + KENYA_OFFSET_MS).toISOString().slice(0, 10);
}

// A Kenyan date + time as the moment it is.
function kenyaMoment(date, time = "00:00") {
  const d = dateOnly(date);
  if (!isDate(d)) return null;
  return new Date(`${d}T${isTime(time) ? time : "00:00"}:00+03:00`);
}

function startsAt(event) {
  return kenyaMoment(event.startDate, event.startTime);
}

// Its end: the end date / time given; a day with no end time runs to the end of that day.
function endsAt(event) {
  const endDate = event.endDate ? dateOnly(event.endDate) : dateOnly(event.startDate);
  if (event.endTime && isTime(event.endTime)) {
    const end = kenyaMoment(endDate, event.endTime);
    const start = startsAt(event);
    return start && end && end > start ? end : new Date((start || end).getTime() + 2 * 3600 * 1000);
  }
  const dayStart = kenyaMoment(endDate, "00:00");
  return dayStart ? new Date(dayStart.getTime() + DAY_MS) : null;
}

// draft | cancelled | upcoming | on_now | ended
function eventState(event, now = new Date()) {
  if (event.status === "cancelled") return "cancelled";
  if (event.status !== "published") return "draft";
  const start = startsAt(event);
  const end = endsAt(event);
  if (end && now >= end) return "ended";
  if (start && now >= start) return "on_now";
  return "upcoming";
}

const isFree = (event) => !(Number(event?.priceAmount) > 0);

// People already holding a place (registered, not cancelled), from a list of registrations.
function seatsTaken(registrations = []) {
  return registrations.filter((r) => r.status === "registered").reduce((sum, r) => sum + Math.max(1, Number(r.partySize) || 1), 0);
}

// Whether people can register now, and what a new registration would get.
//   { open, reason, seatsLeft (null = no limit), full, waitlist }
function registrationState(event, taken = 0, now = new Date()) {
  const capacity = Number(event.capacity) > 0 ? Number(event.capacity) : null;
  const seatsLeft = capacity == null ? null : Math.max(0, capacity - taken);
  const full = capacity != null && seatsLeft <= 0;
  const base = { seatsLeft, full, waitlist: full && Boolean(event.waitlistOn) };
  const state = eventState(event, now);
  if (state === "draft") return { ...base, open: false, reason: "Registration hasn't opened yet." };
  if (state === "cancelled") return { ...base, open: false, reason: "This event has been cancelled." };
  if (state === "ended") return { ...base, open: false, reason: "This event has ended." };
  if (state === "on_now") return { ...base, open: false, reason: "This event has started — registration is closed." };
  if (!event.registrationOpen) return { ...base, open: false, reason: "Registration is closed." };
  if (event.registrationClosesOn && kenyaDateOf(now) > dateOnly(event.registrationClosesOn)) return { ...base, open: false, reason: "Registration has closed." };
  if (full && !event.waitlistOn) return { ...base, open: false, reason: "This event is full." };
  return { ...base, open: true, reason: null };
}

// What a new registration (or a bigger party) gets: "registered", "waitlisted" or "full".
function placeFor(event, taken, partySize) {
  const capacity = Number(event.capacity) > 0 ? Number(event.capacity) : null;
  if (capacity == null || taken + partySize <= capacity) return "registered";
  return event.waitlistOn ? "waitlisted" : "full";
}

// Who comes off the waiting list when places free up: in the order they joined, each whose whole
// party fits (a big family waiting doesn't hold back a single person behind them).
function promotions(event, registrations = []) {
  const capacity = Number(event.capacity) > 0 ? Number(event.capacity) : null;
  const waiting = registrations
    .filter((r) => r.status === "waitlisted")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (capacity == null) return waiting.map((r) => r.id);
  let taken = seatsTaken(registrations);
  const moved = [];
  for (const r of waiting) {
    const size = Math.max(1, Number(r.partySize) || 1);
    if (taken + size <= capacity) {
      moved.push(r.id);
      taken += size;
    }
  }
  return moved;
}

// The group a signed-in person's pop-up audience is decided by.
function audienceGroupOf(user) {
  if (!user) return null;
  if (user.totLearner) return "educators";
  switch (user.role) {
    case "admin":
    case "collaborator":
    case "curriculumAdmin":
      return "staff";
    case "teacher":
      return "educators";
    case "school":
      return "hubs";
    case "supervisor":
      return "supervisors";
    case "affiliate":
      return "affiliates";
    case "learner":
      return user.username && !user.email ? "learners" : "parents";
    default:
      return null;
  }
}

const audienceAllows = (audience, group) => !Array.isArray(audience) || audience.length === 0 || audience.includes(group);

// Whether the event's pop-up shows today — `where` "website" or "system".
function popupShows(event, where, now = new Date()) {
  if (event.status !== "published") return false;
  if (where === "website" && !(event.isPublic && event.websitePopup)) return false;
  if (where === "system" && !event.systemPopup) return false;
  const state = eventState(event, now);
  if (state !== "upcoming") return false;
  const today = kenyaDateOf(now);
  const from = event.popupFrom ? dateOnly(event.popupFrom) : event.publishedAt ? kenyaDateOf(event.publishedAt) : null;
  const until = event.popupUntil ? dateOnly(event.popupUntil) : dateOnly(event.startDate);
  if (from && today < from) return false;
  if (until && today > until) return false;
  return true;
}

// The one pop-up to show: the soonest event.
function soonest(events = []) {
  return [...events].sort((a, b) => (startsAt(a)?.getTime() || 0) - (startsAt(b)?.getTime() || 0))[0] || null;
}

// "Saturday 6 December 2026 · 10:00 – 13:00"
const DAY_NAME = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
function dayLabel(date, short = false) {
  const d = dateOnly(date);
  if (!isDate(d)) return "";
  const parts = Object.fromEntries((short ? SHORT_DAY : DAY_NAME).formatToParts(new Date(`${d}T12:00:00Z`)).map((p) => [p.type, p.value]));
  return [parts.weekday, parts.day, parts.month, parts.year].filter(Boolean).join(" ");
}
function describeWhen(event) {
  const start = dayLabel(event.startDate);
  const multiDay = event.endDate && dateOnly(event.endDate) !== dateOnly(event.startDate);
  const times = event.endTime ? `${event.startTime} – ${event.endTime}` : `from ${event.startTime}`;
  if (multiDay) return `${dayLabel(event.startDate, true)} ${event.startTime} – ${dayLabel(event.endDate, true)}${event.endTime ? ` ${event.endTime}` : ""}`;
  return `${start} · ${times}`;
}

// Children's ages: whole years 1–18, no repeats, smallest first, at most 10.
function cleanAges(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= 1 && n <= 18))].sort((a, b) => a - b).slice(0, 10);
}
const cleanKeys = (list, allowed) => (Array.isArray(list) ? [...new Set(list.filter((k) => Object.hasOwn(allowed, k)))] : []);

// The enquiry a registration makes: what it says, and which programme it's about.
function leadInterestOf(interests = []) {
  for (const key of interests || []) if (LEAD_INTEREST[key]) return LEAD_INTEREST[key];
  return "general";
}
function leadMessage(event, reg) {
  const lines = [`Registered for ${event.title} (${describeWhen(event)}).`];
  lines.push(`${reg.partySize} ${Number(reg.partySize) === 1 ? "person" : "people"} coming${reg.status === "waitlisted" ? " — on the waiting list" : ""}.`);
  if (reg.personType) lines.push(`About them: ${PERSON_TYPES[reg.personType] || reg.personType}${reg.organisation ? ` (${reg.organisation})` : ""}.`);
  const ages = cleanAges(reg.childrenAges);
  if (ages.length) lines.push(`Children aged ${ages.join(", ")}.`);
  const interests = cleanKeys(reg.interests, INTERESTS);
  if (interests.length) lines.push(`Interested in: ${interests.map((k) => INTERESTS[k]).join(", ")}.`);
  if (reg.heardFrom) lines.push(`Heard about us: ${HEARD_FROM[reg.heardFrom] || reg.heardFrom}.`);
  lines.push(reg.marketingConsent ? "Happy to hear about our programmes." : "Didn't ask to hear about our programmes — contact them about this event only.");
  return lines.join("\n");
}

// A calendar file (.ics) for the event. `url` its page; `location` text; `details` plain text.
function icsEscape(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
const icsStamp = (date) => new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function calendarFile(event, { url, location, details, now = new Date() } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Digifunzi//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@digifunzi-events`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(startsAt(event))}`,
    `DTEND:${icsStamp(endsAt(event))}`,
    `SUMMARY:${icsEscape(event.title)}`,
    location ? `LOCATION:${icsEscape(location)}` : null,
    `DESCRIPTION:${icsEscape([details, url].filter(Boolean).join("\n\n"))}`,
    url ? `URL:${url}` : null,
    event.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `${lines.join("\r\n")}\r\n`;
}

// Where it is, in words: the venue / hub, and "Online" for an online part.
function whereText(event, hubName = null) {
  const place = [event.venueName || hubName, event.venueAddress].filter(Boolean).join(", ");
  if (event.format === "online") return "Online";
  if (event.format === "hybrid") return place ? `${place} · or online` : "In person or online";
  return place || "Venue to be confirmed";
}

// How many days until it starts (Kenyan calendar): 0 today, 1 tomorrow, negative once past.
function daysUntil(event, now = new Date()) {
  const today = new Date(`${kenyaDateOf(now)}T00:00:00Z`);
  const start = new Date(`${dateOnly(event.startDate)}T00:00:00Z`);
  return Math.round((start - today) / DAY_MS);
}

module.exports = {
  KINDS, FORMATS, STATUSES, PERSON_TYPES, INTERESTS, HEARD_FROM, AUDIENCE_GROUPS,
  isDate, isTime, dateOnly, kenyaDateOf, kenyaMoment, startsAt, endsAt, eventState, isFree,
  seatsTaken, registrationState, placeFor, promotions, audienceGroupOf, audienceAllows, popupShows, soonest,
  dayLabel, describeWhen, cleanAges, cleanKeys, leadInterestOf, leadMessage, calendarFile, whereText, daysUntil,
};
