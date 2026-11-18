import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCheckCircle, FiCornerUpLeft, FiDollarSign, FiInbox, FiList, FiSettings, FiUser, FiXCircle } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";
import { Tabs } from "../../../components/ui/TabBar";
import { expensesApi, formatMoney } from "../services/expensesApi";
import ClaimList from "../components/ClaimList";
import ClaimView from "../components/ClaimView";
import SettingsPanel from "../components/SettingsPanel";
import MyExpensesPage from "./MyExpensesPage";
import { btn } from "../components/ui";

// Expenses for whoever reviews them.
//   mode "admin"       Finance → Expenses (/expenses): admins, and staff whose role has Expenses —
//                      every claim of the workspace; approving and paying with Edit.
//   mode "supervisor"  the supervisor portal (/supervisor-portal/expenses): the claims of their
//                      educators, plus their own claims (My expenses).
// A claim opens over the page (?claim=<id>) — links in notifications land on it.

const PENDING = new Set(["pending_supervisor", "pending_admin"]);

export default function ExpensesPage({ mode = "admin" }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const supervisor = mode === "supervisor";
  const { data: claims = [], isLoading } = useQuery({ queryKey: ["expenses", "review"], queryFn: expensesApi.review, enabled: params.get("tab") !== "mine" || !supervisor });
  const { data: options } = useQuery({ queryKey: ["expenses", "options"], queryFn: expensesApi.options, enabled: !supervisor });

  const toDecide = claims.filter((c) => PENDING.has(c.status) && c.canDecide);
  const waitingOthers = claims.filter((c) => PENDING.has(c.status) && !c.canDecide);
  const toPay = claims.filter((c) => c.status === "approved");
  const TABS = supervisor
    ? [
      { key: "review", label: "To review", icon: FiInbox, count: toDecide.length || null, alert: toDecide.length > 0 },
      { key: "done", label: "Reviewed", icon: FiList },
      { key: "mine", label: "My expenses", icon: FiUser },
    ]
    : [
      { key: "approve", label: "To approve", icon: FiInbox, count: toDecide.length || null, alert: toDecide.length > 0 },
      { key: "pay", label: "To pay", icon: FiDollarSign, count: toPay.length || null, alert: toPay.length > 0 },
      { key: "paid", label: "Paid", icon: FiCheckCircle },
      { key: "returned", label: "Sent back", icon: FiCornerUpLeft },
      { key: "rejected", label: "Declined", icon: FiXCircle },
      { key: "all", label: "All", icon: FiList },
      ...(options?.canApprove ? [{ key: "settings", label: "Settings", icon: FiSettings }] : []),
    ];
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : TABS[0].key;
  const setTab = (key) => setParams({ tab: key }, { replace: true });
  const openId = params.get("claim");
  const setOpen = (id) => setParams((p) => { const next = new URLSearchParams(p); if (id) next.set("claim", id); else next.delete("claim"); return next; }, { replace: true });

  const lists = {
    review: toDecide,
    done: claims.filter((c) => !PENDING.has(c.status) || !c.canDecide),
    approve: [...toDecide, ...waitingOthers],
    pay: toPay,
    paid: claims.filter((c) => c.status === "paid"),
    returned: claims.filter((c) => c.status === "returned"),
    rejected: claims.filter((c) => c.status === "rejected"),
    all: claims,
  };
  const EMPTY = {
    review: "Nothing waiting for you. Your educators' claims arrive here.",
    done: "No claims reviewed yet.",
    approve: "Nothing waiting for approval.",
    pay: "Nothing approved and waiting to be paid.",
    paid: "No claims paid yet.",
    returned: "No claims are with their claimants to change.",
    rejected: "No declined claims.",
    all: "No expense claims yet.",
  };
  const paidThisMonth = claims.filter((c) => c.status === "paid" && String(c.paidAt || "").slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, c) => s + Number(c.approvedAmount || 0), 0);

  return (
    <div style={{ fontFamily: FONT, display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      {supervisor ? (
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: BRAND.ink, letterSpacing: "-0.5px" }}>Expenses</h1>
      ) : (
        <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff" }}>Expenses</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
              Money the team spent on the organisation's work, claimed back. Open a claim to see each expense and the receipt or M-Pesa message attached to it.
            </p>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, color: "#fff", fontSize: 13 }}>
              <span><strong>{toDecide.length}</strong> to approve</span>
              <span><strong>{formatMoney(toPay.reduce((s, c) => s + Number(c.approvedAmount || 0), 0))}</strong> to pay</span>
              <span><strong>{formatMoney(paidThisMonth)}</strong> paid this month</span>
            </div>
          </div>
          <Link to="/my-expenses" style={{ ...btn, padding: "11px 18px", fontSize: 14, background: "rgba(255,255,255,0.14)", color: "#fff", borderColor: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
            <FiUser size={15} /> My expenses
          </Link>
        </div>
      )}

      <Tabs label="Expenses" value={tab} onChange={setTab} tabs={TABS} />

      {tab === "mine" && <MyExpensesPage embedded />}
      {tab === "settings" && <SettingsPanel />}
      {tab !== "mine" && tab !== "settings" && (
        isLoading ? <p style={{ color: BRAND.muted, fontSize: 13 }}>Loading…</p> : (
          <>
            {tab === "approve" && waitingOthers.length > 0 && (
              <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>
                {waitingOthers.length} {waitingOthers.length === 1 ? "claim is" : "claims are"} with a supervisor, or {waitingOthers.length === 1 ? "is" : "are"} yours — someone else decides {waitingOthers.length === 1 ? "it" : "them"}.
              </p>
            )}
            <ClaimList claims={lists[tab] || []} onOpen={setOpen} showClaimant empty={EMPTY[tab]} />
          </>
        )
      )}

      {openId && tab !== "mine" && <ClaimView id={openId} onClose={() => { setOpen(null); qc.invalidateQueries({ queryKey: ["expenses", "review"] }); }} onEdit={(claim) => (supervisor ? setParams({ tab: "mine", claim: claim.id }) : navigate(`/my-expenses?claim=${claim.id}`))} />}
    </div>
  );
}
