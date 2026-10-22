// Calendar arithmetic for check-ins — pure, no database, so it's tested on its own
// (test/checkins.test.js). Dates are "YYYY-MM-DD" calendar dates in Kenyan time.

const MONTHS_FOR = { monthly: 1, quarterly: 3, semi_annually: 6, annually: 12 };

const pad = (n) => String(n).padStart(2, "0");
const toStr = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const parse = (str) => {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

// Today in Kenya (EAT, UTC+3), whatever the server's own time zone.
function todayInKenya(now = new Date()) {
  return toStr(new Date(now.getTime() + 3 * 60 * 60 * 1000));
}

function addDays(str, days) {
  const date = parse(str);
  date.setUTCDate(date.getUTCDate() + days);
  return toStr(date);
}

// `months` after `start`, kept on the start's day of the month — or the month's last day when it
// has fewer (31 Jan → 28/29 Feb → 31 Mar …, always measured from the start, so it never drifts).
function addMonths(start, months) {
  const s = parse(start);
  const target = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(s.getUTCDate(), lastDay));
  return toStr(target);
}

// The nth occurrence (0 = the start) of a schedule.
function nthOccurrence(startDate, frequency, n) {
  if (frequency === "weekly") return addDays(startDate, 7 * n);
  if (MONTHS_FOR[frequency]) return addMonths(startDate, MONTHS_FOR[frequency] * n);
  return startDate;
}

// A schedule's occurrence dates from `from` up to `until` (both inclusive), and past that the
// next one too when `includeNext` — so a quarterly or yearly schedule always has its next session
// on the calendar. Dates before `from` (before the schedule was set up, or before a change to it)
// are never produced, so a schedule backdated to January doesn't fill the past with missed
// check-ins. Stops at the schedule's end date. A one-off has just its start date, even a past one
// (writing up a check-in that already happened).
function occurrenceDates({ startDate, endDate = null, frequency }, until, { from = startDate, includeNext = true, max = 600 } = {}) {
  if (frequency === "once") return endDate && startDate > endDate ? [] : [startDate];
  const dates = [];
  for (let n = 0; n < max; n += 1) {
    const date = nthOccurrence(startDate, frequency, n);
    if (endDate && date > endDate) break;
    if (date > until) {
      if (includeNext && date >= from) dates.push(date);
      break;
    }
    if (date >= from) dates.push(date);
  }
  return dates;
}

module.exports = { todayInKenya, addDays, addMonths, nthOccurrence, occurrenceDates };
