const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const NotificationService = require("../notifications/notification.service");
const {
  normaliseSettings, effectiveTargets, teamTargets, measureProgress, overallState, milestoneReached,
  isMonth, monthOf, addMonths, monthBounds, daysInMonth, monthLabel, daysLeftIn, portalRouteOf, money,
} = require("./affiliate.rules");

// Affiliate targets (25 Nov 2026) — see CLAUDE.md "Affiliates". Monthly, Kenyan calendar, tracking
// only (reaching one earns nothing extra):
//   money    what the families an affiliate brought in paid in the month — every successful payment
//            on their invoices (paid in parts too), never an affiliate's own invoice credit
//   families families whose first invoice was paid in full in the month (referral.firstPaidAt)
// Cancelled referrals count for nothing. Worked out from the records each time; a month that's over
// is saved once (affiliate_target_results — closeMonth) so its history never shifts. A manager also
// has a team target: them and everyone under them together.
// New tables, newer collation: no SQL joins to older tables — look things up separately.

const A = "affiliates";
const R = "affiliate_referrals";
const S = "affiliate_settings";
const T = "affiliate_target_results";
const CREDIT_METHOD = "affiliate_credit";
const COUNTED = ["active", "suspended"];
// The invoice column that ties a subscription's every period to its referral.
const RECORD_COLUMN = { home_learning: "householdId", tech_club: "clubMembershipId", pathway: "pathwaySubscriptionId" };
const CHUNK = 800;

const chunks = (list) => {
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
};
const inRange = (d, { from, to }) => d && new Date(d) >= from && new Date(d) < to;

async function settingsOf(ownerAdminId) {
  const row = ownerAdminId ? await db(S).where({ ownerAdminId }).first() : null;
  const raw = typeof row?.settings === "string" ? JSON.parse(row.settings || "{}") : row?.settings;
  return normaliseSettings(raw);
}

// What each affiliate reached in a month: Map id → { money, families, onTheWay } (onTheWay =
// families who signed up in the month and haven't paid yet).
async function measure(affiliateIds, month) {
  const ids = [...new Set(affiliateIds.filter(Boolean))];
  const out = new Map(ids.map((id) => [id, { money: 0, families: 0, onTheWay: 0 }]));
  if (!ids.length) return out;
  const range = monthBounds(month);
  const referrals = [];
  for (const part of chunks(ids)) {
    referrals.push(...(await db(R).whereIn("affiliateId", part).whereNot({ status: "cancelled" })
      .select("id", "affiliateId", "programme", "recordId", "invoiceId", "status", "firstPaidAt", "createdAt")));
  }
  for (const r of referrals) {
    const m = out.get(r.affiliateId);
    if (inRange(r.firstPaidAt, range)) m.families += 1;
    if (r.status === "signed_up" && inRange(r.createdAt, range)) m.onTheWay += 1;
  }

  // Each referred family's invoices: a subscription's every period, else the sign-up's own invoice.
  const affiliateOfInvoice = new Map();
  for (const r of referrals) if (r.invoiceId) affiliateOfInvoice.set(r.invoiceId, r.affiliateId);
  for (const [programme, column] of Object.entries(RECORD_COLUMN)) {
    const byRecord = new Map(referrals.filter((r) => r.programme === programme && r.recordId).map((r) => [r.recordId, r.affiliateId]));
    for (const part of chunks([...byRecord.keys()])) {
      const invoices = await db("billing_invoices").whereIn(column, part).select("id", column);
      for (const inv of invoices) affiliateOfInvoice.set(inv.id, byRecord.get(inv[column]));
    }
  }
  for (const part of chunks([...affiliateOfInvoice.keys()])) {
    const payments = await db("billing_payments").whereIn("invoiceId", part).where({ status: "successful" })
      .where((q) => q.whereNull("paymentMethod").orWhereNot("paymentMethod", CREDIT_METHOD))
      .whereRaw("COALESCE(paidAt, createdAt) >= ? AND COALESCE(paidAt, createdAt) < ?", [range.from, range.to])
      .select("invoiceId", "amount");
    for (const p of payments) {
      const m = out.get(affiliateOfInvoice.get(p.invoiceId));
      if (m) m.money = money(m.money + Number(p.amount || 0));
    }
  }
  return out;
}

// One affiliate's standing from targets + what they reached.
function standing(targets, reached, month, today) {
  const moneyP = measureProgress(targets.money, reached.money, month, today);
  const familiesP = measureProgress(targets.families, reached.families, month, today);
  return { money: moneyP, families: familiesP, onTheWay: reached.onTheWay ?? 0, state: overallState([moneyP, familiesP]), ownTargets: Boolean(targets.own) };
}

// Live rows for a month: every active / suspended affiliate in `affiliates`, with a manager's team.
async function liveRows(settings, affiliates, month, today = new Date()) {
  const counted = affiliates.filter((a) => COUNTED.includes(a.status));
  const reached = await measure(counted.map((a) => a.id), month);
  const targetsOf = new Map(counted.map((a) => [a.id, effectiveTargets(settings, a)]));
  return counted.map((a) => {
    const row = {
      affiliate: { id: a.id, name: a.name, code: a.code, kind: a.kind, status: a.status, isManager: Boolean(a.isManager), managerId: a.managerId || null },
      own: standing(targetsOf.get(a.id), reached.get(a.id), month, today),
      team: null,
    };
    if (a.isManager) {
      const members = counted.filter((m) => m.managerId === a.id);
      const everyone = [a, ...members];
      const sum = everyone.reduce((t, m) => {
        const r = reached.get(m.id);
        return { money: money(t.money + r.money), families: t.families + r.families, onTheWay: t.onTheWay + r.onTheWay };
      }, { money: 0, families: 0, onTheWay: 0 });
      const targets = teamTargets(a, everyone.map((m) => targetsOf.get(m.id)));
      row.team = { ...standing(targets, sum, month, today), size: members.length };
    }
    return row;
  });
}

// A closed month's saved rows, shaped like live ones.
function savedRows(results, affiliatesById, month) {
  const byAffiliate = new Map();
  for (const r of results) {
    const entry = byAffiliate.get(r.affiliateId) || {};
    entry[r.scope] = r;
    byAffiliate.set(r.affiliateId, entry);
  }
  const shape = (r) => standing(
    { money: r.moneyTarget != null ? Number(r.moneyTarget) : null, families: r.familiesTarget },
    { money: money(r.money), families: Number(r.families) || 0, onTheWay: 0 },
    month,
  );
  return [...byAffiliate.entries()].map(([id, e]) => {
    const a = affiliatesById.get(id) || { id, name: "Removed affiliate" };
    return {
      affiliate: { id, name: a.name, code: a.code || null, kind: a.kind || null, status: a.status || null, isManager: Boolean(e.team), managerId: a.managerId || null },
      own: e.own ? shape(e.own) : standing({}, { money: 0, families: 0 }, month),
      team: e.team ? { ...shape(e.team), size: e.team.teamSize ?? 0 } : null,
    };
  });
}

// Saves a month that's over for a workspace, once (the first call wins; later ones find it saved).
// Counts the affiliates who were there before the month ended and weren't pending or removed.
async function closeMonth(ownerAdminId, month, today = new Date()) {
  if (!ownerAdminId || !isMonth(month) || month >= monthOf(today)) return 0;
  if (await db(T).where({ ownerAdminId, month }).first("id")) return 0;
  const { to } = monthBounds(month);
  const affiliates = await db(A).where({ ownerAdminId }).whereIn("status", COUNTED).where("createdAt", "<", to);
  if (!affiliates.length) return 0;
  const rows = await liveRows(await settingsOf(ownerAdminId), affiliates, month, today);
  const at = new Date();
  const record = (r, scope, s, teamSize = null) => ({
    id: generateId(), ownerAdminId, affiliateId: r.affiliate.id, month, scope,
    moneyTarget: s.money.target, familiesTarget: s.families.target, money: s.money.value, families: s.families.value,
    teamSize, met: s.state === "none" ? null : s.state === "met", closedAt: at,
  });
  const inserts = rows.flatMap((r) => [record(r, "own", r.own), ...(r.team ? [record(r, "team", r.team, r.team.size)] : [])]);
  for (const part of chunks(inserts)) await db(T).insert(part).onConflict(["affiliateId", "month", "scope"]).ignore();
  return inserts.length;
}

// Last month saved, if no one has yet (the cron does it on the 1st; a page asking does it too).
const ensureClosed = (ownerAdminId, today = new Date()) => closeMonth(ownerAdminId, addMonths(monthOf(today), -1), today);

const summaryOf = (rows) => {
  const withTarget = rows.filter((r) => r.own.state !== "none");
  const count = (s) => withTarget.filter((r) => r.own.state === s).length;
  return {
    affiliates: rows.length, withTarget: withTarget.length,
    met: count("met"), onTrack: count("on_track"), behind: count("behind"), missed: count("missed"),
    money: money(rows.reduce((t, r) => t + r.own.money.value, 0)),
    families: rows.reduce((t, r) => t + r.own.families.value, 0),
    onTheWay: rows.reduce((t, r) => t + (r.own.onTheWay || 0), 0),
  };
};

const ksh = (n) => `KSh ${money(n).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

const AffiliateTargets = {
  measure,
  closeMonth,
  ensureClosed,

  // Every workspace with affiliates: last month saved (npm run billing:process).
  async closeDueMonths(today = new Date()) {
    const owners = await db(A).distinct("ownerAdminId").pluck("ownerAdminId");
    let saved = 0;
    for (const ownerAdminId of owners) saved += await ensureClosed(ownerAdminId, today).catch((err) => { console.error("[affiliates] could not close a target month:", err.message); return 0; });
    return { saved };
  },

  // The admin's Targets tab: every affiliate's standing in a month (this month live; a month that's
  // over as it was saved — or worked out now when it was never saved).
  async board(ownerAdminId, month = null, today = new Date()) {
    const current = monthOf(today);
    const wanted = isMonth(month) ? month : current;
    if (wanted > current) throw Object.assign(new Error("That month hasn't started yet."), { statusCode: 400 });
    await ensureClosed(ownerAdminId, today);
    const settings = await settingsOf(ownerAdminId);
    const affiliates = await db(A).where({ ownerAdminId });
    let rows;
    let saved = false;
    if (wanted < current) {
      const results = await db(T).where({ ownerAdminId, month: wanted });
      if (results.length) {
        rows = savedRows(results, new Map(affiliates.map((a) => [a.id, a])), wanted);
        saved = true;
      }
    }
    if (!rows) {
      const { to } = monthBounds(wanted);
      rows = await liveRows(settings, affiliates.filter((a) => new Date(a.createdAt) < to), wanted, today);
    }
    rows.sort((a, b) => a.affiliate.name.localeCompare(b.affiliate.name));
    return {
      month: wanted, label: monthLabel(wanted), current: wanted === current, saved,
      days: daysInMonth(wanted), daysLeft: daysLeftIn(wanted, today),
      defaults: { money: settings.targetMoney || null, families: settings.targetFamilies || null },
      months: Array.from({ length: 12 }, (_, i) => addMonths(current, -i)).map((m) => ({ month: m, label: monthLabel(m) })),
      summary: summaryOf(rows),
      rows,
    };
  },

  // This month's own standing for each of a workspace's affiliates (the Affiliates list's column).
  async currentFor(ownerAdminId, affiliates, today = new Date()) {
    const rows = await liveRows(await settingsOf(ownerAdminId), affiliates, monthOf(today), today);
    return new Map(rows.map((r) => [r.affiliate.id, r.own]));
  },

  // The affiliate's own Refer & earn: this month (theirs, and a manager's team) and the months saved.
  async forAffiliate(affiliate, today = new Date()) {
    if (!affiliate || !COUNTED.includes(affiliate.status)) return null;
    const month = monthOf(today);
    const settings = await settingsOf(affiliate.ownerAdminId);
    await ensureClosed(affiliate.ownerAdminId, today).catch(() => 0);
    const group = affiliate.isManager ? [affiliate, ...(await db(A).where({ managerId: affiliate.id }))] : [affiliate];
    const row = (await liveRows(settings, group, month, today)).find((r) => r.affiliate.id === affiliate.id);
    const saved = await db(T).where({ affiliateId: affiliate.id }).orderBy("month", "desc").limit(12);
    const history = [...new Set(saved.map((r) => r.month))].slice(0, 6).map((m) => {
      const own = saved.find((r) => r.month === m && r.scope === "own");
      const team = saved.find((r) => r.month === m && r.scope === "team");
      const shape = (r) => r && ({ money: money(r.money), families: Number(r.families) || 0, moneyTarget: r.moneyTarget != null ? money(r.moneyTarget) : null, familiesTarget: r.familiesTarget ?? null, met: r.met == null ? null : Boolean(r.met) });
      return { month: m, label: monthLabel(m), own: shape(own), team: shape(team) };
    });
    return {
      month, label: monthLabel(month), days: daysInMonth(month), daysLeft: daysLeftIn(month, today),
      own: row?.own || null, team: row?.team || null, history,
    };
  },

  // After a referred family paid (affiliate.service.js's onInvoicePaid): the bell when the affiliate
  // passes halfway or reaches a target this month, and when a manager's team reaches theirs. Each
  // once per month and measure (dedupe keys). Never throws.
  async afterPayment(affiliate, today = new Date()) {
    try {
      if (!affiliate || affiliate.status !== "active") return;
      const settings = await settingsOf(affiliate.ownerAdminId);
      if (!settings.targetNotices) return;
      const month = monthOf(today);
      const label = monthLabel(month).split(" ")[0];
      const manager = affiliate.managerId ? await db(A).where({ id: affiliate.managerId }).first() : null;
      const lead = affiliate.isManager ? affiliate : manager?.isManager && manager.status === "active" ? manager : null;
      const group = lead ? [lead, ...(await db(A).where({ managerId: lead.id }))] : [affiliate];
      const rows = await liveRows(settings, group, month, today);
      const mine = rows.find((r) => r.affiliate.id === affiliate.id);
      const words = (key, p) => (key === "money" ? `${ksh(p.value)} of ${ksh(p.target)} brought in` : `${p.value} of ${p.target} ${p.target === 1 ? "family" : "families"} paying`);
      const tell = async (who, standingOf, team) => {
        if (!who?.userId || !standingOf) return;
        for (const key of ["money", "families"]) {
          const p = standingOf[key];
          const reached = p.state === "none" ? null : milestoneReached(p.percent);
          if (!reached || (team && reached !== 100)) continue;
          const title = team
            ? `Your team reached its ${label} target`
            : reached === 100 ? `You reached your ${label} target` : `Halfway to your ${label} target`;
          await NotificationService.notifyPerson(who.userId, {
            type: team ? "affiliate_team_target_met" : reached === 100 ? "affiliate_target_met" : "affiliate_target_half",
            title,
            message: `${words(key, p)}${!team && reached === 50 ? ` — ${daysLeftIn(month, today)} days left` : ""}.`,
            payload: { route: portalRouteOf(who) },
            dedupeKey: `affiliate_target:${who.id}:${month}:${team ? "team" : "own"}:${key}:${reached}`,
          }).catch(() => {});
        }
      };
      await tell(affiliate, mine?.own, false);
      if (lead) await tell(lead, rows.find((r) => r.affiliate.id === lead.id)?.team, true);
    } catch (err) {
      console.error("[affiliates] could not check targets:", err.message);
    }
  },
};

module.exports = AffiliateTargets;
