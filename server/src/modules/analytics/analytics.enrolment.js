// Enrolment & income (10 Nov 2026, admins only) — from a website enquiry to a family still learning,
// and the money it brings, for the workspace's hubs in scope.
//   funnel     enquiries made in the period (leads), then: signed up (a learner, invoice, household
//              or club place came of it), paid (any payment on its invoice), still learning (the
//              learner / household / club place is active today). Per programme — the enquiry's
//              invoice type when it has one (so a pathway sign-up counts as Pathways), else what it
//              was interested in.
//   income     successful payments, month by month for 12 months, per programme; the period's total
//              against the one before; what is still owed on open invoices
//   lapsed     subscriptions paused or cancelled in the period, and learners paused today for an
//              unpaid invoice
//   affiliates referrals made in the period per affiliate, how many paid, commission earned
// Website enquiries with no hub belong to every workspace's view (one website for the
// installation) and are left out when one hub is chosen.

const db = require("../../config/db");
const { inChunks, pct, kenyaDay, startOfKenyaDay, endOfKenyaDay } = require("./analytics.utils");
const { monthsUpTo } = require("./analytics.trends");

const PROGRAMMES = {
  bootcamp: "Bootcamps",
  home_learning: "Home Learning",
  tech_club: "Tech Clubs",
  pathway: "Pathways",
  store: "Store",
  hubs: "Schools & hubs",
  enquiry: "General enquiries",
};
const programmeOfInvoice = (type) => ({
  bootcamp: "bootcamp", home_learning: "home_learning", tech_club: "tech_club",
  pathway: "pathway", pathway_subscription: "pathway", store_order: "store",
  hub_usage: "hubs", hub_subscription: "hubs",
}[type] || null);
const programmeOfInterest = (interest) => ({
  bootcamp: "bootcamp", home_schooling: "home_learning", home_learning: "home_learning", tech_club: "tech_club",
  pathway: "pathway", project: "store", quarky: "store", store_item: "store",
}[interest] || "enquiry");
const isPaid = (inv) => inv && (inv.status === "paid" || Number(inv.amountPaid) > 0);

async function getEnrolment(scope) {
  if (scope.isHubView) return { hidden: true };
  const { period } = scope;
  const hubSet = new Set(scope.hubIds);
  const hubChosen = Boolean(scope.filters.hubId);

  // ── Funnel ──────────────────────────────────────────────────────────────────────────────────────
  const leads = (await db("leads").whereBetween("createdAt", [period.start, period.end]).whereNull("anonymisedAt")
    .select("id", "interestedIn", "source", "learnerId", "invoiceId", "homeLearningHouseholdId", "clubMembershipId", "hubId", "paidAt", "visitSource", "createdAt"))
    .filter((l) => (l.hubId ? hubSet.has(l.hubId) : !hubChosen));
  const invoices = await inChunks(leads.map((l) => l.invoiceId), (ids) => db("billing_invoices").whereIn("id", ids).select("id", "invoiceType", "status", "amountPaid"));
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const activeLearners = new Set((await inChunks(leads.map((l) => l.learnerId), (ids) => db("learner_hub_links").whereIn("learnerId", ids).where({ status: "active" }).select("learnerId"))).map((r) => r.learnerId));
  const activeHouseholds = new Set((await inChunks(leads.map((l) => l.homeLearningHouseholdId), (ids) => db("home_learning_households").whereIn("id", ids).where({ status: "active" }).select("id"))).map((r) => r.id));
  const activeClubs = new Set((await inChunks(leads.map((l) => l.clubMembershipId), (ids) => db("club_memberships").whereIn("id", ids).where({ status: "active" }).select("id"))).map((r) => r.id));

  const blank = () => ({ enquiries: 0, signedUp: 0, paid: 0, learning: 0 });
  const funnelBy = new Map();
  const total = blank();
  const bySource = new Map();
  for (const l of leads) {
    const inv = l.invoiceId ? invoiceById.get(l.invoiceId) : null;
    const key = programmeOfInvoice(inv?.invoiceType) || programmeOfInterest(l.interestedIn);
    const signedUp = Boolean(l.learnerId || l.invoiceId || l.homeLearningHouseholdId || l.clubMembershipId);
    const paid = Boolean(l.paidAt) || isPaid(inv);
    // Still learning: paid, and the place is active today (a pipeline stage never exceeds the one before).
    const learning = paid && ((l.learnerId && activeLearners.has(l.learnerId)) || (l.homeLearningHouseholdId && activeHouseholds.has(l.homeLearningHouseholdId)) || (l.clubMembershipId && activeClubs.has(l.clubMembershipId)));
    const x = funnelBy.get(key) || blank();
    for (const [k, on] of [["enquiries", true], ["signedUp", signedUp], ["paid", paid], ["learning", learning]]) {
      if (!on) continue;
      x[k] += 1;
      total[k] += 1;
    }
    funnelBy.set(key, x);
    // Where the enquiry came from (the website's first-visit record — leads/visit-source.js).
    let vs = l.visitSource;
    if (typeof vs === "string") { try { vs = JSON.parse(vs); } catch { vs = null; } }
    const source = vs?.ref ? "Affiliate link" : vs?.utmSource ? String(vs.utmSource) : vs?.referrer ? (() => { try { return new URL(vs.referrer).hostname.replace(/^www\./, ""); } catch { return "Another site"; } })() : vs ? "Direct" : "Not recorded";
    const s = bySource.get(source) || { enquiries: 0, signedUp: 0, paid: 0 };
    s.enquiries += 1; if (signedUp) s.signedUp += 1; if (paid) s.paid += 1;
    bySource.set(source, s);
  }
  const funnel = [...funnelBy.entries()].map(([key, x]) => ({ key, label: PROGRAMMES[key] || key, ...x, conversion: pct(x.paid, x.enquiries) }))
    .sort((a, b) => b.enquiries - a.enquiries);

  // ── Income ──────────────────────────────────────────────────────────────────────────────────────
  const months = monthsUpTo(period.to);
  const incomeStart = startOfKenyaDay(months[0].from);
  const scopeInvoices = scope.hubIds.length ? await db("billing_invoices").whereIn("hubId", scope.hubIds).select("id", "invoiceType", "status", "total", "amountPaid", "dueAt") : [];
  const invTypeById = new Map(scopeInvoices.map((i) => [i.id, i.invoiceType]));
  const payments = await inChunks(scopeInvoices.map((i) => i.id), (ids) => db("billing_payments").whereIn("invoiceId", ids).where({ status: "successful" })
    .where((q) => q.where("paymentDate", ">=", incomeStart).orWhere("paidAt", ">=", incomeStart).orWhere("createdAt", ">=", incomeStart))
    .select("invoiceId", "amount", "paymentMethod", "paymentDate", "paidAt", "createdAt"));
  const byMonth = new Map(months.map((m) => [m.key, { month: m.key, label: m.label, total: 0 }]));
  const programmeTotals = new Map();
  let inPeriod = 0;
  let inPrev = 0;
  for (const p of payments) {
    if (p.paymentMethod === "affiliate_credit") continue; // credit given, not money in
    const when = p.paymentDate || p.paidAt || p.createdAt;
    const day = kenyaDay(when);
    const amount = Number(p.amount) || 0;
    const key = programmeOfInvoice(invTypeById.get(p.invoiceId)) || "other";
    const row = byMonth.get(day?.slice(0, 7));
    if (row) { row.total += amount; row[key] = (row[key] || 0) + amount; }
    if (day >= period.from && day <= period.to) { inPeriod += amount; programmeTotals.set(key, (programmeTotals.get(key) || 0) + amount); }
    if (day >= period.prevFrom && day <= period.prevTo) inPrev += amount;
  }
  const owed = scopeInvoices.filter((i) => ["issued", "partially_paid", "overdue"].includes(i.status))
    .reduce((n, i) => n + Math.max(0, (Number(i.total) || 0) - (Number(i.amountPaid) || 0)), 0);
  const overdue = scopeInvoices.filter((i) => ["issued", "partially_paid", "overdue"].includes(i.status) && i.dueAt && new Date(i.dueAt) < new Date()).length;

  // ── Lapsed ──────────────────────────────────────────────────────────────────────────────────────
  const owner = scope.ownerAdminId;
  const inPeriodDate = (v) => v && new Date(v) >= period.start && new Date(v) <= period.end;
  const subs = owner ? await db("pathway_subscriptions").where({ ownerAdminId: owner }).select("hubId", "status", "pausedAt", "cancelledAt") : [];
  const households = owner ? await db("home_learning_households").where({ ownerAdminId: owner }).whereIn("status", ["paused", "cancelled"]).select("status", "updatedAt") : [];
  const clubs = owner ? await db("club_memberships").where({ ownerAdminId: owner }).whereIn("status", ["paused", "cancelled"]).select("hubId", "status", "updatedAt") : [];
  const lapsed = [
    { key: "pathway", label: PROGRAMMES.pathway,
      paused: subs.filter((s) => (!hubChosen || hubSet.has(s.hubId)) && inPeriodDate(s.pausedAt)).length,
      cancelled: subs.filter((s) => (!hubChosen || hubSet.has(s.hubId)) && inPeriodDate(s.cancelledAt)).length,
      active: subs.filter((s) => (!hubChosen || hubSet.has(s.hubId)) && s.status === "active").length },
    { key: "home_learning", label: PROGRAMMES.home_learning,
      paused: hubChosen ? 0 : households.filter((h) => h.status === "paused" && inPeriodDate(h.updatedAt)).length,
      cancelled: hubChosen ? 0 : households.filter((h) => h.status === "cancelled" && inPeriodDate(h.updatedAt)).length,
      active: hubChosen ? 0 : (await db("home_learning_households").where({ ownerAdminId: owner || "-", status: "active" }).count({ n: "*" }).first()).n },
    { key: "tech_club", label: PROGRAMMES.tech_club,
      paused: clubs.filter((c) => (!hubChosen || hubSet.has(c.hubId)) && c.status === "paused" && inPeriodDate(c.updatedAt)).length,
      cancelled: clubs.filter((c) => (!hubChosen || hubSet.has(c.hubId)) && c.status === "cancelled" && inPeriodDate(c.updatedAt)).length,
      active: Number((await db("club_memberships").where({ ownerAdminId: owner || "-", status: "active" }).modify((q) => { if (hubChosen) q.whereIn("hubId", scope.hubIds); }).count({ n: "*" }).first()).n) },
  ].map((x) => ({ ...x, active: Number(x.active) || 0 }));
  const pausedForUnpaid = (await inChunks([...scope.learnerIds], (ids) => db("billing_access_pauses").whereIn("learnerId", ids).whereNull("resumedAt").distinct("learnerId"))).length;

  // ── Affiliates ──────────────────────────────────────────────────────────────────────────────────
  const referrals = owner ? await db("affiliate_referrals").where({ ownerAdminId: owner }).whereBetween("createdAt", [period.start, period.end]).select("affiliateId", "status", "firstPaidAt") : [];
  const commissions = owner ? await db("affiliate_commissions").where({ ownerAdminId: owner }).whereBetween("createdAt", [period.start, period.end]).whereNot("status", "cancelled").select("affiliateId", "amount") : [];
  const affIds = [...new Set([...referrals, ...commissions].map((r) => r.affiliateId))];
  const affiliates = affIds.length ? await db("affiliates").whereIn("id", affIds).select("id", "name", "code") : [];
  const affById = new Map(affiliates.map((a) => [a.id, a]));
  const affRows = new Map();
  for (const r of referrals) {
    const x = affRows.get(r.affiliateId) || { referrals: 0, paid: 0, commission: 0 };
    x.referrals += 1; if (r.firstPaidAt) x.paid += 1;
    affRows.set(r.affiliateId, x);
  }
  for (const c of commissions) {
    const x = affRows.get(c.affiliateId) || { referrals: 0, paid: 0, commission: 0 };
    x.commission += Number(c.amount) || 0;
    affRows.set(c.affiliateId, x);
  }

  return {
    period,
    programmes: PROGRAMMES,
    funnel, funnelTotal: { ...total, conversion: pct(total.paid, total.enquiries) },
    sources: [...bySource.entries()].map(([label, x]) => ({ label, ...x })).sort((a, b) => b.enquiries - a.enquiries),
    income: {
      months: [...byMonth.values()],
      inPeriod, previous: inPrev,
      byProgramme: [...programmeTotals.entries()].map(([key, amount]) => ({ key, label: PROGRAMMES[key] || "Other", amount })).sort((a, b) => b.amount - a.amount),
      owed, overdue,
      currency: "KES",
    },
    lapsed, pausedForUnpaid,
    affiliates: [...affRows.entries()].map(([id, x]) => ({ affiliateId: id, name: affById.get(id)?.name || "Affiliate", code: affById.get(id)?.code || "", ...x }))
      .sort((a, b) => b.paid - a.paid || b.referrals - a.referrals),
    end: endOfKenyaDay(period.to),
  };
}

module.exports = { getEnrolment, PROGRAMMES };
