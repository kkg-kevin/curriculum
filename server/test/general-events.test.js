const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/general-events/general-event.rules");

const event = (over = {}) => ({
  id: "ev1", title: "Bootcamp showcase", status: "published", startDate: "2026-12-06", startTime: "10:00", endDate: null, endTime: "13:00",
  format: "in_person", capacity: null, waitlistOn: true, registrationOpen: true, registrationClosesOn: null,
  isPublic: true, websitePopup: true, systemPopup: true, popupFrom: null, popupUntil: null, publishedAt: "2026-11-12T08:00:00Z", ...over,
});
const at = (iso) => new Date(iso);

test("times are Kenyan: start, end, and a day without an end time", () => {
  assert.equal(R.startsAt(event()).toISOString(), "2026-12-06T07:00:00.000Z");
  assert.equal(R.endsAt(event()).toISOString(), "2026-12-06T10:00:00.000Z");
  assert.equal(R.endsAt(event({ endTime: null })).toISOString(), "2026-12-06T21:00:00.000Z");
  // An end time before the start (a typo) still gives it two hours.
  assert.equal(R.endsAt(event({ endTime: "09:00" })).toISOString(), "2026-12-06T09:00:00.000Z");
  assert.equal(R.kenyaDateOf(at("2026-12-05T22:30:00Z")), "2026-12-06");
});

test("an event is a draft, upcoming, on now, ended or cancelled", () => {
  assert.equal(R.eventState(event({ status: "draft" })), "draft");
  assert.equal(R.eventState(event({ status: "cancelled" })), "cancelled");
  assert.equal(R.eventState(event(), at("2026-12-06T06:59:00Z")), "upcoming");
  assert.equal(R.eventState(event(), at("2026-12-06T08:00:00Z")), "on_now");
  assert.equal(R.eventState(event(), at("2026-12-06T10:00:00Z")), "ended");
});

test("capacity counts people; full means the waiting list, or closed without one", () => {
  const regs = [{ status: "registered", partySize: 3 }, { status: "cancelled", partySize: 4 }, { status: "waitlisted", partySize: 2 }, { status: "registered", partySize: 1 }];
  assert.equal(R.seatsTaken(regs), 4);
  const now = at("2026-11-20T08:00:00Z");
  assert.deepEqual(R.registrationState(event({ capacity: 10 }), 4, now), { seatsLeft: 6, full: false, waitlist: false, open: true, reason: null });
  assert.equal(R.registrationState(event({ capacity: 4 }), 4, now).waitlist, true);
  assert.equal(R.registrationState(event({ capacity: 4 }), 4, now).open, true);
  const closed = R.registrationState(event({ capacity: 4, waitlistOn: false }), 4, now);
  assert.equal(closed.open, false);
  assert.match(closed.reason, /full/);
  assert.equal(R.registrationState(event(), 999, now).seatsLeft, null);
  assert.equal(R.placeFor(event({ capacity: 5 }), 3, 2), "registered");
  assert.equal(R.placeFor(event({ capacity: 5 }), 3, 3), "waitlisted");
  assert.equal(R.placeFor(event({ capacity: 5, waitlistOn: false }), 3, 3), "full");
  assert.equal(R.placeFor(event(), 300, 5), "registered");
});

test("registration closes: switched off, after its closing day, once started", () => {
  const now = at("2026-11-20T08:00:00Z");
  assert.equal(R.registrationState(event({ registrationOpen: false }), 0, now).open, false);
  assert.equal(R.registrationState(event({ registrationClosesOn: "2026-11-19" }), 0, now).open, false);
  assert.equal(R.registrationState(event({ registrationClosesOn: "2026-11-20" }), 0, now).open, true);
  assert.equal(R.registrationState(event(), 0, at("2026-12-06T08:00:00Z")).open, false);
  assert.equal(R.registrationState(event({ status: "draft" }), 0, now).open, false);
});

test("the waiting list moves up in order, skipping a party that doesn't fit", () => {
  const regs = [
    { id: "a", status: "registered", partySize: 3, createdAt: "2026-11-01" },
    { id: "w1", status: "waitlisted", partySize: 4, createdAt: "2026-11-02" },
    { id: "w2", status: "waitlisted", partySize: 1, createdAt: "2026-11-03" },
    { id: "w3", status: "waitlisted", partySize: 1, createdAt: "2026-11-04" },
  ];
  assert.deepEqual(R.promotions(event({ capacity: 5 }), regs), ["w2", "w3"]);
  assert.deepEqual(R.promotions(event({ capacity: 8 }), regs), ["w1", "w2"]);
  assert.deepEqual(R.promotions(event({ capacity: null }), regs), ["w1", "w2", "w3"]);
});

test("pop-ups show from publishing until the day it starts, for the chosen people", () => {
  const ev = event();
  assert.equal(R.popupShows(ev, "website", at("2026-11-20T08:00:00Z")), true);
  assert.equal(R.popupShows(ev, "website", at("2026-11-11T08:00:00Z")), false); // before publishing
  assert.equal(R.popupShows(ev, "website", at("2026-12-06T08:00:00Z")), false); // started
  assert.equal(R.popupShows({ ...ev, websitePopup: false }, "website", at("2026-11-20T08:00:00Z")), false);
  assert.equal(R.popupShows({ ...ev, isPublic: false }, "website", at("2026-11-20T08:00:00Z")), false);
  assert.equal(R.popupShows({ ...ev, isPublic: false }, "system", at("2026-11-20T08:00:00Z")), true);
  assert.equal(R.popupShows({ ...ev, popupUntil: "2026-11-19" }, "system", at("2026-11-20T08:00:00Z")), false);
  assert.equal(R.popupShows({ ...ev, popupFrom: "2026-11-25" }, "system", at("2026-11-20T08:00:00Z")), false);
  assert.equal(R.popupShows({ ...ev, status: "draft" }, "system", at("2026-11-20T08:00:00Z")), false);
  assert.equal(R.audienceAllows(null, "parents"), true);
  assert.equal(R.audienceAllows([], "hubs"), true);
  assert.equal(R.audienceAllows(["parents"], "hubs"), false);
  assert.equal(R.soonest([event({ id: "late", startDate: "2026-12-20" }), event({ id: "early" })]).id, "early");
});

test("each login falls into one audience group", () => {
  assert.equal(R.audienceGroupOf({ role: "admin" }), "staff");
  assert.equal(R.audienceGroupOf({ role: "collaborator" }), "staff");
  assert.equal(R.audienceGroupOf({ role: "teacher" }), "educators");
  assert.equal(R.audienceGroupOf({ role: "learner", totLearner: true }), "educators");
  assert.equal(R.audienceGroupOf({ role: "learner", email: "p@x.com" }), "parents");
  assert.equal(R.audienceGroupOf({ role: "learner", username: "amani", email: null }), "learners");
  assert.equal(R.audienceGroupOf({ role: "school" }), "hubs");
  assert.equal(R.audienceGroupOf({ role: "affiliate" }), "affiliates");
});

test("about-you answers are cleaned; the enquiry says what they told us", () => {
  assert.deepEqual(R.cleanAges([7, "10", 7, 0, 19, 3.6, "x"]), [4, 7, 10]);
  assert.deepEqual(R.cleanKeys(["bootcamps", "nope", "bootcamps", "pathways"], R.INTERESTS), ["bootcamps", "pathways"]);
  assert.equal(R.leadInterestOf(["pathways", "tech_clubs"]), "tech_club");
  assert.equal(R.leadInterestOf([]), "general");
  const msg = R.leadMessage(event(), { partySize: 3, status: "registered", personType: "parent", childrenAges: [7, 10], interests: ["bootcamps"], heardFrom: "whatsapp", marketingConsent: true });
  assert.match(msg, /Registered for Bootcamp showcase \(Sunday 6 December 2026 · 10:00 – 13:00\)/);
  assert.match(msg, /3 people coming\./);
  assert.match(msg, /Children aged 7, 10/);
  assert.match(msg, /Holiday bootcamps/);
  assert.match(msg, /WhatsApp/);
  assert.match(R.leadMessage(event(), { partySize: 1, status: "waitlisted", marketingConsent: false }), /waiting list[\s\S]*this event only/);
});

test("a calendar file with the right times, escaped text, cancelled when cancelled", () => {
  const ics = R.calendarFile(event({ title: "Show, tell; and more" }), { url: "https://x.test/events/s", location: "Hub A, Nairobi", details: "Line 1\nLine 2", now: at("2026-11-12T00:00:00Z") });
  assert.match(ics, /DTSTART:20261206T070000Z/);
  assert.match(ics, /DTEND:20261206T100000Z/);
  assert.match(ics, /SUMMARY:Show\\, tell\\; and more/);
  assert.match(ics, /LOCATION:Hub A\\, Nairobi/);
  assert.match(ics, /DESCRIPTION:Line 1\\nLine 2\\n\\nhttps:\/\/x.test\/events\/s/);
  assert.match(ics, /\r\n/);
  assert.match(R.calendarFile(event({ status: "cancelled" })), /STATUS:CANCELLED/);
});

test("when and where, in words", () => {
  assert.equal(R.describeWhen(event()), "Sunday 6 December 2026 · 10:00 – 13:00");
  assert.equal(R.describeWhen(event({ endTime: null })), "Sunday 6 December 2026 · from 10:00");
  assert.equal(R.describeWhen(event({ endDate: "2026-12-07", endTime: "12:00" })), "Sun 6 Dec 10:00 – Mon 7 Dec 12:00");
  assert.equal(R.whereText(event({ venueName: "Kilimani Hub", venueAddress: "Argwings Kodhek Rd" })), "Kilimani Hub, Argwings Kodhek Rd");
  assert.equal(R.whereText(event(), "Westlands Hub"), "Westlands Hub");
  assert.equal(R.whereText(event({ format: "online" }), "Westlands Hub"), "Online");
  assert.equal(R.whereText(event({ format: "hybrid" }), "Westlands Hub"), "Westlands Hub · or online");
  assert.equal(R.daysUntil(event(), at("2026-12-04T20:59:00Z")), 2);
  assert.equal(R.daysUntil(event(), at("2026-12-05T21:00:00Z")), 0);
  assert.equal(R.isFree(event()), true);
  assert.equal(R.isFree(event({ priceAmount: "500.00" })), false);
});
