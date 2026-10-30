// How often a package is billed — the client's wording for server/src/shared/utils/billing-periods.js.
// Every period but a daily one is invoiced automatically on its first day, counted from the day the
// family joins; a daily package is invoiced at the end of each month for the days a child was
// marked present or late.

export const BILLING_PERIODS = [
  { value: "daily", label: "Daily", unit: "day", how: "Invoiced at the end of each month for the days a child attended (present or late). Can't be offered on the website." },
  { value: "weekly", label: "Weekly", unit: "week", how: "Invoiced every week, from the day the family joins." },
  { value: "monthly", label: "Monthly", unit: "month", how: "Invoiced every month, from the day the family joins." },
  { value: "quarterly", label: "Quarterly", unit: "quarter", how: "Invoiced every 3 months, from the day the family joins." },
  { value: "annually", label: "Annually", unit: "year", how: "Invoiced every year, from the day the family joins." },
];

const BY_VALUE = Object.fromEntries(BILLING_PERIODS.map((p) => [p.value, p]));

export const periodUnit = (billingPeriod) => BY_VALUE[billingPeriod]?.unit || "month";
export const periodHow = (billingPeriod) => BY_VALUE[billingPeriod]?.how || BY_VALUE.monthly.how;

export const formatKsh = (amount) => `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;

// "KSh 2,500/week"
export const pricePer = (amount, billingPeriod) => `${formatKsh(amount)}/${periodUnit(billingPeriod)}`;

// "14 Nov 2026" for a "YYYY-MM-DD" date, never shifted by the viewer's timezone.
export function formatDay(value) {
  const [y, m, d] = String(value || "").slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
}

// One line for a family's card: what's billed next and when, and any change waiting for it
// (the server's billingOutlook). Null when the family isn't billed now.
export function outlookLine(outlook) {
  if (!outlook?.next) return null;
  const next = outlook.billingPeriod === "daily"
    ? `Next invoice ${formatDay(outlook.next.raisedOn)} — days attended in ${outlook.next.label} × ${formatKsh(outlook.amount)}`
    : `Next invoice ${formatDay(outlook.next.raisedOn)} — ${outlook.next.label}, ${formatKsh(outlook.amount)}`;
  const change = outlook.pending ? ` · Changes to ${pricePer(outlook.pending.amount, outlook.pending.billingPeriod)} from ${formatDay(outlook.pending.from)}` : "";
  return next + change;
}
