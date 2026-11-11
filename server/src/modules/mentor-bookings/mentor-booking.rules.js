const { addDays } = require("../checkins/checkin.dates");
const { toMinutes, fromMinutes, weekdayOf, slotKey, timesOverlap } = require("../mentor-checkins/mentor-checkin.rules");

// Mentor bookings — the rules, with nothing read or written (tested in test/mentor-bookings.test.js).
//
// Settings (Settings → Educator Pay → Mentor bookings, one per workspace): on/off, the lengths a
// family can book, each with what the family pays and what the mentor earns, how much notice, how
// long an unpaid time is held, and how late a family may still cancel for their money back.
// Times are Kenyan: a booking is a date and a start/end "HH:MM".

const LENGTHS = [30, 45, 60, 90, 120];
const DEFAULT_SETTINGS = {
  enabled: false,
  lengths: [{ minutes: 30, price: null, educatorPay: null }, { minutes: 60, price: null, educatorPay: null }],
  noticeHours: 24,
  holdMinutes: 120,
  cancelHours: 24,
  horizonDays: 21,
};
// Free times are offered on this grid (minutes past the hour).
const STEP_MINUTES = 30;
const ACTIVE = ["held", "confirmed"];
const money = (v) => Math.round(Number(v || 0) * 100) / 100;
const numOrNull = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// Stored (or typed) settings → clean settings, or the first thing wrong.
function cleanSettings(raw = {}) {
  const src = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  const seen = new Set();
  const lengths = [];
  for (const row of Array.isArray(src.lengths) ? src.lengths : []) {
    const minutes = Number(row?.minutes);
    if (!LENGTHS.includes(minutes) || seen.has(minutes)) continue;
    seen.add(minutes);
    lengths.push({ minutes, price: numOrNull(row.price), educatorPay: numOrNull(row.educatorPay) });
  }
  lengths.sort((a, b) => a.minutes - b.minutes);
  const whole = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const settings = {
    enabled: !!src.enabled,
    lengths,
    noticeHours: whole(src.noticeHours, 1, 336, DEFAULT_SETTINGS.noticeHours),
    holdMinutes: whole(src.holdMinutes, 15, 2880, DEFAULT_SETTINGS.holdMinutes),
    cancelHours: whole(src.cancelHours, 0, 336, DEFAULT_SETTINGS.cancelHours),
    horizonDays: whole(src.horizonDays, 3, 90, DEFAULT_SETTINGS.horizonDays),
  };
  let error = null;
  if (settings.enabled) {
    if (!lengths.length) error = "Offer at least one session length";
    else {
      const bad = lengths.find((l) => !(l.price > 0) || l.educatorPay == null || l.educatorPay < 0);
      if (bad) error = `Set what families pay and what the mentor earns for ${bad.minutes} minutes`;
      else if (lengths.some((l) => l.educatorPay > l.price)) error = "A mentor can't earn more than the family pays for a session";
    }
  }
  return { settings, error };
}

// What one length costs: { price, educatorPay } — null when it isn't offered.
function priceFor(settings, minutes) {
  const row = (settings.lengths || []).find((l) => l.minutes === Number(minutes));
  return row && row.price > 0 ? { price: money(row.price), educatorPay: money(row.educatorPay || 0) } : null;
}

// A hub space's fee for this long (learning_hubs.spaces[]: hourly / daily / fixed / free).
function deskFeeFor(space, minutes) {
  if (!space) return 0;
  const rate = Number(space.rate) || 0;
  switch (space.pricingModel) {
    case "free": return 0;
    case "hourly": return money(rate * (Number(minutes) / 60));
    case "daily":
    case "fixed": return money(rate);
    default: return 0;
  }
}

// The partner hub's share of a desk fee: all of it, less the share the workspace keeps for
// collecting it. A hub of the workspace's own ("ours") is owed nothing.
function hubShareFor(deskFee, owner, collectionPercent = 0) {
  if (owner !== "hub" || !(deskFee > 0)) return 0;
  const pct = Math.min(100, Math.max(0, Number(collectionPercent) || 0));
  return money(deskFee * (1 - pct / 100));
}

// Kenyan "now": today's date and the minutes past midnight.
function kenyaNow(date = new Date()) {
  const k = new Date(date.getTime() + 3 * 3600 * 1000);
  return { date: k.toISOString().slice(0, 10), minutes: k.getUTCHours() * 60 + k.getUTCMinutes() };
}
// A Kenyan date + time as a real instant.
const instantOf = (date, time) => new Date(`${date}T${time}:00+03:00`);
const hoursUntil = (booking, now = new Date()) => (instantOf(String(booking.date).slice(0, 10), booking.startTime) - now) / 3600000;

// The times a mentor can be booked for `minutes`: inside their weekly availability (windows of
// { dayOfWeek, startTime, endTime }), on the STEP grid, from `notice` hours from now to `horizonDays`
// ahead, never when they're busy (`busy`: { weekly: [{ dayOfWeek, startTime, endTime }], dated:
// [{ date, startTime, endTime }] } — their classes, check-ins and other bookings). A mentor with no
// availability declared has no bookable times.
function freeSlots({ windows = [], minutes, busy = {}, noticeHours = 24, horizonDays = 21, now = new Date(), from = null, to = null }) {
  const len = Number(minutes);
  if (!(len > 0) || !windows.length) return [];
  const earliest = kenyaNow(new Date(now.getTime() + noticeHours * 3600 * 1000));
  const start = from && from > earliest.date ? from : earliest.date;
  const end = to || addDays(kenyaNow(now).date, horizonDays);
  const slots = [];
  for (let date = start, guard = 0; date <= end && guard < 120; date = addDays(date, 1), guard += 1) {
    const day = weekdayOf(date);
    const seen = new Set();
    for (const w of windows.filter((x) => x.dayOfWeek === day)) {
      const wStart = Math.ceil(toMinutes(w.startTime) / STEP_MINUTES) * STEP_MINUTES;
      for (let t = wStart; t + len <= toMinutes(w.endTime); t += STEP_MINUTES) {
        if (date === earliest.date && t < earliest.minutes) continue;
        const slot = { date, startTime: fromMinutes(t), endTime: fromMinutes(t + len) };
        if (seen.has(slot.startTime)) continue;
        seen.add(slot.startTime);
        if (isBusy(slot, busy)) continue;
        slots.push({ ...slot, key: slotKey(date, slot.startTime) });
      }
    }
  }
  return slots.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
}

function isBusy(slot, busy = {}) {
  const day = weekdayOf(slot.date);
  if ((busy.weekly || []).some((b) => b.dayOfWeek === day && timesOverlap(slot, b))) return true;
  return (busy.dated || []).some((b) => String(b.date).slice(0, 10) === slot.date && timesOverlap(slot, b));
}

// Whether a booking still holds its time: confirmed, or held and not yet run out.
function holdsTime(b, now = new Date()) {
  if (b.status === "confirmed") return true;
  return b.status === "held" && (!b.holdExpiresAt || new Date(b.holdExpiresAt) > now);
}

// How many people a space can take at once.
const spaceCapacity = (space) => Math.max(1, Number(space?.maxCapacity) || 1);

// Where a booking stands, for the screens.
//   held          waiting for payment      confirmed     paid, still to come
//   today         paid, today              to_mark       paid, started, not yet marked
//   completed / no_show / cancelled
function bookingState(b, now = new Date()) {
  if (["completed", "no_show", "cancelled"].includes(b.status)) return b.status;
  if (b.status === "held") return holdsTime(b, now) ? "held" : "cancelled";
  const k = kenyaNow(now);
  const date = String(b.date).slice(0, 10);
  if (date < k.date || (date === k.date && toMinutes(b.startTime) <= k.minutes)) return "to_mark";
  return date === k.date ? "today" : "confirmed";
}

// Whether the mentor (or staff) may say how it went: once it has started.
const canMark = (b, now = new Date()) => b.status === "confirmed" && hoursUntil(b, now) <= 0;

// Cancelling. Returns { allowed, reason?, refund, keepHubShare }:
//   held (not paid)   anyone involved may cancel — the invoice is cancelled, nothing to give back
//   by the parent     up to `cancelHours` before the start — everything paid comes back; later
//                     than that it can't be cancelled (it's charged as booked)
//   by the mentor or staff, any time before it's marked — everything paid comes back
// A refunded booking owes the partner hub nothing.
function cancelOutcome(b, { by, paid = 0, cancelHours = 24, now = new Date() }) {
  if (!ACTIVE.includes(b.status)) return { allowed: false, reason: "This booking can't be cancelled now" };
  if (b.status === "held") return { allowed: true, refund: 0, keepHubShare: false };
  if (by === "parent" && hoursUntil(b, now) < cancelHours) {
    return { allowed: false, reason: `It starts in less than ${cancelHours} hours, so it can't be cancelled now — it's charged as booked. Ask the team if something has come up.` };
  }
  return { allowed: true, refund: money(paid), keepHubShare: false };
}

// The mentor sessions left in a plan's period: included less those already used.
const allowanceLeft = (included, used) => Math.max(0, (Number(included) || 0) - (Number(used) || 0));

module.exports = {
  LENGTHS, DEFAULT_SETTINGS, STEP_MINUTES, ACTIVE, money,
  cleanSettings, priceFor, deskFeeFor, hubShareFor, kenyaNow, instantOf, hoursUntil,
  freeSlots, isBusy, holdsTime, spaceCapacity, bookingState, canMark, cancelOutcome, allowanceLeft,
};
