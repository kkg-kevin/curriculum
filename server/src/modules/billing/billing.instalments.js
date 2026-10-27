const { todayInKenya, addDays, addMonths } = require("../checkins/checkin.dates");

// Part payments — the rules, with no database (tested on their own, test/billing-instalments.test.js).
//
// An invoice may have a schedule: parts (instalments), each with a label, an amount and a due date,
// adding up to the invoice's total. Payments go onto the invoice as always and count towards the
// earliest part first, so each part's state is worked out from what's been paid:
//   paid      nothing left on it
//   overdue   its due date has passed with something left
//   due       due today
//   upcoming  not due yet (`partPaid` when some of it is paid)
// An invoice with no schedule counts as one part due on its due date (never overdue without one).

const money = (value) => Number(Number(value || 0).toFixed(2));
const kenyaDate = (value) => (value ? todayInKenya(new Date(value)) : null);
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);

// `total` in `count` parts of whole shillings; the last takes the difference (and any cents).
function splitEvenly(total, count) {
  const base = Math.floor(money(total) / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? money(total - base * (count - 1)) : base));
}

// A plan's parts for an invoice of `total`, the first due `startDate`, the rest `intervalMonths`
// apart. With `depositPercent`, the first part is that share (whole shillings) and the rest share
// what's left; without, all are equal. Null when the total is too small for that many parts.
function scheduleFromPlan(total, plan, startDate) {
  const count = Number(plan.count);
  if (!count || count < 2) return null;
  let amounts;
  if (plan.depositPercent) {
    const first = Math.round((money(total) * Number(plan.depositPercent)) / 100);
    amounts = [first, ...splitEvenly(money(total - first), count - 1)];
  } else {
    amounts = splitEvenly(total, count);
  }
  if (amounts.some((a) => a <= 0)) return null;
  const interval = Number(plan.intervalMonths) || 1;
  return amounts.map((amount, i) => ({
    sequence: i + 1,
    label: i === 0 ? (plan.depositPercent ? "Deposit" : "Payment 1") : `Payment ${i + 1}`,
    amount,
    dueDate: i === 0 ? startDate : addMonths(startDate, i * interval),
  }));
}

// A schedule typed by staff: what's wrong with it (empty when it's fine). Parts in date order,
// each above zero, together exactly the total.
function scheduleProblems(rows, total) {
  const problems = [];
  if (!Array.isArray(rows) || rows.length < 2) return ["A schedule has at least 2 payments"];
  if (rows.length > 24) problems.push("A schedule has at most 24 payments");
  rows.forEach((r, i) => {
    if (!(money(r.amount) > 0)) problems.push(`Payment ${i + 1} needs an amount above 0`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.dueDate || ""))) problems.push(`Payment ${i + 1} needs a due date`);
    else if (i > 0 && String(r.dueDate) < String(rows[i - 1].dueDate)) problems.push(`Payment ${i + 1} is due before payment ${i}`);
  });
  const sum = money(rows.reduce((s, r) => s + money(r.amount), 0));
  if (sum !== money(total)) problems.push(`The payments add up to ${sum.toLocaleString("en-KE")}, not the invoice's ${money(total).toLocaleString("en-KE")}`);
  return problems;
}

// Each part with what's been paid on it and its state, payments counting earliest part first.
function partStates(parts, amountPaid, today = todayInKenya()) {
  let left = money(amountPaid);
  return parts.map((part) => {
    const amount = money(part.amount);
    const paid = money(Math.min(left, amount));
    left = money(left - paid);
    const remaining = money(amount - paid);
    const due = part.dueDate ? String(part.dueDate).slice(0, 10) : null;
    const state = remaining <= 0 ? "paid" : !due ? "upcoming" : due < today ? "overdue" : due === today ? "due" : "upcoming";
    return { ...part, amount, dueDate: due, paid, remaining, state, partPaid: paid > 0 && remaining > 0 };
  });
}

// An invoice's parts: its schedule, or — with none — the whole invoice due on its due date.
function partsOf(invoice, instalments) {
  if (instalments?.length) return instalments;
  return [{ sequence: 1, label: "Full amount", amount: money(invoice.total), dueDate: kenyaDate(invoice.dueAt), whole: true }];
}

// Where an invoice's payments stand: the next part to pay, how much is overdue and since when.
function paymentPosition(invoice, instalments, amountPaid, today = todayInKenya()) {
  const parts = partStates(partsOf(invoice, instalments), amountPaid, today);
  const next = parts.find((p) => p.remaining > 0) || null;
  const overdue = parts.filter((p) => p.state === "overdue");
  const overdueSince = overdue.length ? overdue[0].dueDate : null;
  return {
    parts,
    hasSchedule: Boolean(instalments?.length),
    next: next ? { sequence: next.sequence, label: next.label, amount: next.remaining, dueDate: next.dueDate, state: next.state } : null,
    overdueAmount: money(overdue.reduce((s, p) => s + p.remaining, 0)),
    overdueSince,
    daysOverdue: overdueSince ? daysBetween(overdueSince, today) : 0,
  };
}

// Which reminder is owed for a part today, if any: "upcoming" (`daysBefore` days ahead), "due" (on
// the day), "overdue" (the day after) and "final" (the day the grace days run out — when access
// pauses). One kind per part per day; each is sent once (the caller's dedupe key).
function reminderFor(part, today, { daysBefore = 3, graceDays = 7 } = {}) {
  if (!part.dueDate || part.remaining <= 0) return null;
  if (daysBefore > 0 && part.dueDate === addDays(today, daysBefore)) return "upcoming";
  if (part.dueDate === today) return "due";
  const late = daysBetween(part.dueDate, today);
  if (late === 1) return "overdue";
  if (graceDays > 1 && late === graceDays) return "final";
  return null;
}

module.exports = { money, scheduleFromPlan, scheduleProblems, partStates, partsOf, paymentPosition, reminderFor, splitEvenly };
