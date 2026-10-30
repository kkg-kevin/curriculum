// Billing periods for packages (Home Learning, Tech Clubs) — every rule about "which dates does an
// invoice cover" lives here, so the sign-ups, the automatic invoicing (modules/billing/
// package-billing.js) and the screens all agree. Pure: dates are "YYYY-MM-DD" strings, Kenyan
// calendar dates (the caller passes `today`).
//
// A package is billed every day, week, month, quarter or year (`billingPeriod`). A family's
// periods start on the day they join (`billingAnchor`): a monthly family joining on 14 Nov is
// billed 14 Nov – 13 Dec, then 14 Dec – 13 Jan, … (a day past the end of a short month is held at
// its last day: joining on 31 Jan gives 28 Feb, then 31 Mar). Every period except a daily one is
// billed in advance, on its first day. A daily package is billed in arrears, at the end of each
// calendar month, for the days the family's children were marked present or late.
// `billedThrough` is the last day already billed; the next period is the first one after it.
// A change of package or price takes effect from the next period (`pendingBilling`).

const PERIODS = ["daily", "weekly", "monthly", "quarterly", "annually"];
const UNIT = { daily: "day", weekly: "week", monthly: "month", quarterly: "quarter", annually: "year" };
const MONTHS_PER = { monthly: 1, quarterly: 3, annually: 12 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Invoices are due a week after they're raised (an advance period's invoice by its last day at
// the latest).
const DUE_AFTER_DAYS = 7;
// Part-payment plans are only offered on a package invoice covering roughly a quarter or more —
// splitting a week's or a month's fee into instalments makes no sense.
const MIN_DAYS_FOR_PLANS = 85;

const pad = (n) => String(n).padStart(2, "0");
const toDate = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromDate = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // m is 0-based

function addDays(date, n) {
  const dt = toDate(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromDate(dt);
}

// `months` after `date`, keeping its day of the month (held at the target month's last day).
function addMonths(date, months) {
  const dt = toDate(date);
  const total = dt.getUTCMonth() + months;
  const y = dt.getUTCFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return `${y}-${pad(m + 1)}-${pad(Math.min(dt.getUTCDate(), daysInMonth(y, m)))}`;
}

function monthEnd(date) {
  const dt = toDate(date);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(daysInMonth(dt.getUTCFullYear(), dt.getUTCMonth()))}`;
}

function daysBetween(start, end) {
  return Math.round((toDate(end) - toDate(start)) / 86400000) + 1;
}

// The k-th period (0 = the first) of a weekly / monthly / quarterly / yearly package from `anchor`.
function periodAt(billingPeriod, anchor, k) {
  if (billingPeriod === "weekly") return { start: addDays(anchor, 7 * k), end: addDays(anchor, 7 * k + 6) };
  const n = MONTHS_PER[billingPeriod];
  if (!n) throw new Error(`No period rule for "${billingPeriod}"`);
  return { start: addMonths(anchor, k * n), end: addDays(addMonths(anchor, (k + 1) * n), -1) };
}

// The next period to bill for a family: { start, end }. A daily package's runs to the end of the
// calendar month it starts in.
function nextPeriod({ billingPeriod, billingAnchor, billedThrough }) {
  if (billingPeriod === "daily") {
    const start = billedThrough ? addDays(billedThrough, 1) : billingAnchor;
    return { start, end: monthEnd(start) };
  }
  if (!billedThrough || billedThrough < billingAnchor) return periodAt(billingPeriod, billingAnchor, 0);
  // The first period starting after the last day billed. Weekly periods are counted straight;
  // month-based ones are stepped (a day held at a month's end makes them uneven).
  if (billingPeriod === "weekly") {
    const k = Math.floor(daysBetween(billingAnchor, billedThrough) / 7);
    return periodAt("weekly", billingAnchor, k + (periodAt("weekly", billingAnchor, k).start > billedThrough ? 0 : 1));
  }
  let k = Math.max(0, Math.floor((daysBetween(billingAnchor, billedThrough) - 1) / (31 * MONTHS_PER[billingPeriod])));
  while (periodAt(billingPeriod, billingAnchor, k).start <= billedThrough) k += 1;
  return periodAt(billingPeriod, billingAnchor, k);
}

// "November 2026" for a whole calendar month, "2026" for a whole calendar year, otherwise the range:
// "14 Nov – 13 Dec 2026", "28 Dec 2026 – 3 Jan 2027".
function periodLabel(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  if (s.getUTCDate() === 1 && end === monthEnd(start)) return `${MONTH_NAMES[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  if (sameYear && start.slice(5) === "01-01" && end.slice(5) === "12-31") return String(s.getUTCFullYear());
  const day = (dt, withYear) => `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}${withYear ? ` ${dt.getUTCFullYear()}` : ""}`;
  return `${day(s, !sameYear)} – ${day(e, true)}`;
}

// When an invoice raised on `raisedOn` for a period ending `periodEnd` is due: a week later, by the
// period's end at the latest — but never before the day it's raised (a period caught up late).
function dueDateFor(billingPeriod, raisedOn, periodEnd) {
  const due = addDays(raisedOn, DUE_AFTER_DAYS);
  if (billingPeriod === "daily" || due <= periodEnd) return due;
  return periodEnd > raisedOn ? periodEnd : raisedOn;
}

// The first day a change of package or price applies to — the start of the next period not billed
// yet. A daily package's current month is still running (billed at its end), so its change starts
// the next month. Null when nothing has been billed yet: the change applies straight away.
function changeFrom(record) {
  if (!record.billedThrough) return null;
  const next = nextPeriod(record);
  return record.billingPeriod === "daily" ? addDays(next.end, 1) : next.start;
}

// The fields to save when a family's price or period changes to `{ amount, billingPeriod }`:
// straight away when nothing has been billed, otherwise from the next period (`pendingBilling`).
function scheduleChange(record, { amount, billingPeriod }) {
  const same = Number(record.amount) === Number(amount) && record.billingPeriod === billingPeriod;
  if (same) return record.pendingBilling ? { pendingBilling: null } : {};
  const from = changeFrom(record);
  if (!from) return { amount, billingPeriod, pendingBilling: null };
  return { pendingBilling: { amount, billingPeriod, from } };
}

// The fields to save when a waiting change is reached (the next period starts on or after its day).
function dueChange(record) {
  const pending = record.pendingBilling;
  if (!pending?.from || nextPeriod(record).start < pending.from) return null;
  const switchesPeriod = pending.billingPeriod !== record.billingPeriod;
  return {
    amount: pending.amount,
    billingPeriod: pending.billingPeriod,
    // A new period type starts its own run of periods on the day the change applies.
    ...(switchesPeriod ? { billingAnchor: pending.from, billedThrough: addDays(pending.from, -1) } : {}),
    pendingBilling: null,
  };
}

// The fields to save when a family becomes active. A family joining (nothing billed yet) starts its
// periods on its start date, or today; one coming back from paused / cancelled starts afresh today
// (the time away isn't billed), on any change that was waiting.
function onActivation(record, { today, startDate = null }) {
  if (!record.billedThrough) return { billingAnchor: startDate || record.startDate || today };
  if (record.status !== "paused" && record.status !== "cancelled") return {};
  // Back before the period already paid for ran out: carry on as before.
  if (record.billedThrough >= addDays(today, -1)) return {};
  const pending = record.pendingBilling;
  return {
    ...(pending ? { amount: pending.amount, billingPeriod: pending.billingPeriod, pendingBilling: null } : {}),
    billingAnchor: today,
    billedThrough: addDays(today, -1),
  };
}

// Whether part-payment plans may be offered on this invoice: always for anything that isn't a
// package's, and for a package invoice only when it covers about a quarter or more.
function allowsPlans(invoice) {
  if (!["home_learning", "tech_club"].includes(invoice?.invoiceType)) return true;
  if (!invoice.periodStart || !invoice.periodEnd) return true;
  return daysBetween(String(invoice.periodStart).slice(0, 10), String(invoice.periodEnd).slice(0, 10)) >= MIN_DAYS_FOR_PLANS;
}

const perUnit = (billingPeriod) => UNIT[billingPeriod] || "month";

module.exports = {
  PERIODS, UNIT, addDays, addMonths, monthEnd, daysBetween, periodAt, nextPeriod, periodLabel, dueDateFor,
  changeFrom, scheduleChange, dueChange, onActivation, allowsPlans, perUnit,
};
