import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiEye, FiFileText, FiSearch } from "react-icons/fi";
import { useWorkspaceClaims } from "../hooks/useClaims";
import { T, cardStyle, formatDate, formatMoney } from "../shared";
import { InvoicePanel, useSideBySide } from "../components/ClaimInvoiceViewer";

// Claim invoices, for the workspace (/billing/claim-invoices): every invoice the system generated
// from an educator's claim, and whether it is still to be paid or has been paid. A declined claim's
// invoice is void, so it isn't listed. Clicking one shows it beside the list, as on the other
// invoice screens, with its eTIMS invoice a switch away.

const PAYMENT = {
  pending: { label: "Pending payment", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  paid: { label: "Paid", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
};
const paymentOf = (claim) => (claim.status === "paid" ? "paid" : "pending");

function PaymentPill({ claim }) {
  const p = PAYMENT[paymentOf(claim)];
  return <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>{p.label}</span>;
}

function Total({ label, count, value, tone, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{ ...cardStyle, padding: "14px 16px", textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", border: `2px solid ${active ? T.accent : "#EEF1F5"}`, background: active ? "#F3F8FC" : "#fff" }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: active ? T.accent : T.inkMuted }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 21, fontWeight: 900, color: tone || T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted }}>{count} {count === 1 ? "invoice" : "invoices"}</p>
    </button>
  );
}

export default function ClaimInvoicesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useWorkspaceClaims();
  // The three totals at the top double as the filter: all, pending payment, paid.
  const [filter, setFilter] = useState("all");
  const [schoolId, setSchoolId] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null); // { id, kind: "claim" | "etims" }
  const wide = useSideBySide();

  // Every claim with a live invoice — declined ones are void.
  const invoices = useMemo(() => (data?.claims || []).filter((c) => c.status !== "rejected").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [data]);
  const schools = useMemo(() => {
    const byId = new Map();
    for (const c of invoices) if (c.hubId && !byId.has(c.hubId)) byId.set(c.hubId, c.hubName || "School");
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);

  // Everything but the payment filter, so the totals say what choosing each would show.
  const scoped = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return invoices
      .filter((c) => schoolId === "all" || c.hubId === schoolId)
      .filter((c) => {
        if (!words.length) return true;
        const text = [c.claimNumber, c.teacherName, c.courseName, c.className, c.hubName, c.paymentReference].filter(Boolean).join(" ").toLowerCase();
        return words.every((w) => text.includes(w));
      });
  }, [invoices, schoolId, search]);
  const shown = useMemo(() => scoped.filter((c) => filter === "all" || paymentOf(c) === filter), [scoped, filter]);
  const sum = (list) => list.reduce((total, c) => total + c.amount, 0);
  const pending = scoped.filter((c) => paymentOf(c) === "pending");
  const paid = scoped.filter((c) => paymentOf(c) === "paid");
  const currency = invoices[0]?.currency || "KES";
  const money = (value) => formatMoney(value, currency);

  const viewed = viewing ? invoices.find((c) => c.id === viewing.id) || null : null;
  const closeViewer = () => setViewing(null);
  const panel = viewed && <InvoicePanel claim={viewed} kind={viewing.kind} onKind={(kind) => setViewing({ id: viewed.id, kind })} onClose={closeViewer} />;

  const back = (
    <button type="button" onClick={() => navigate("/billing?tab=claims")} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", color: T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
      <FiArrowLeft size={14} /> Educator Claims
    </button>
  );

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted, fontSize: 14, padding: "60px 0", textAlign: "center" }}>Loading claim invoices…</p>;
  if (isError) {
    return (
      <div style={{ ...cardStyle, fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Claim invoices couldn&apos;t be loaded</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
      </div>
    );
  }

  const list = (
    <div style={{ ...cardStyle, overflow: "hidden", minWidth: 0 }}>
      {shown.map((c, index) => {
        const selected = viewed?.id === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setViewing({ id: c.id, kind: "claim" })}
            aria-pressed={selected}
            style={{ display: "flex", alignItems: "center", gap: viewed ? 10 : 16, width: "100%", padding: "14px 18px", textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", border: "none", borderTop: index ? "1px solid #F1F5F9" : "none", background: selected ? T.tintBg : "#fff", flexWrap: "wrap" }}
          >
            <span style={{ flex: viewed ? "1 1 100%" : "1 1 260px", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.inkFaint }}>{c.claimNumber} · {formatDate(c.createdAt)}</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 14.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.teacherName}</span>
              <span style={{ display: "block", marginTop: 1, fontSize: 12.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[c.courseName, c.className, c.hubName].filter(Boolean).join(" · ")}</span>
            </span>
            <span style={{ flex: "0 1 auto", fontSize: 15, fontWeight: 900, color: T.accent, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{money(c.amount)}</span>
            <span style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, marginLeft: viewed ? "auto" : 0 }}>
              <PaymentPill claim={c} />
              {c.status === "paid" && c.paidAt && <span style={{ fontSize: 11, color: T.inkMuted }}>{formatDate(c.paidAt)}</span>}
            </span>
            {!viewed && (
              <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.accentMid }}>
                <FiEye size={14} /> View
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      {back}
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>Claim invoices</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>Every invoice generated from an educator&apos;s claim, and whether it&apos;s been paid. Declined claims aren&apos;t listed — their invoices are void.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Total label="All" count={scoped.length} value={money(sum(scoped))} active={filter === "all"} onClick={() => setFilter("all")} />
        <Total label="Pending payment" count={pending.length} value={money(sum(pending))} tone="#B45309" active={filter === "pending"} onClick={() => setFilter("pending")} />
        <Total label="Paid" count={paid.length} value={money(sum(paid))} tone="#047857" active={filter === "paid"} onClick={() => setFilter("paid")} />
      </div>

      {invoices.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
            <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no., educator, course or reference" aria-label="Search claim invoices" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: 11, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" }} />
          </div>
          {schools.length > 1 && (
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="Filter by school" style={{ padding: "10px 12px", borderRadius: 11, border: `1.5px solid ${schoolId !== "all" ? T.accent : T.border}`, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", color: T.ink, background: "#fff", cursor: "pointer" }}>
              <option value="all">All schools</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      )}

      {invoices.length === 0 ? (
        <div style={{ ...cardStyle, padding: "48px 24px", textAlign: "center" }}>
          <FiFileText size={28} color={T.inkFaint} />
          <p style={{ margin: "10px 0 4px", fontSize: 15, fontWeight: 800, color: T.ink }}>No claim invoices yet</p>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>An invoice is generated each time an educator requests payment.</p>
        </div>
      ) : shown.length === 0 ? (
        <p style={{ ...cardStyle, margin: 0, padding: "28px 20px", textAlign: "center", fontSize: 13.5, color: T.inkMuted }}>No claim invoices match.</p>
      ) : viewed && !wide ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={closeViewer} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", color: T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            <FiArrowLeft size={14} /> All claim invoices
          </button>
          <ClaimLink claim={viewed} />
          <div style={{ height: "78vh" }}>{panel}</div>
        </div>
      ) : viewed ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
          {list}
          <div style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 8, height: "calc(100vh - 120px)", minHeight: 420 }}>
            <ClaimLink claim={viewed} />
            <div style={{ flex: 1, minHeight: 0 }}>{panel}</div>
          </div>
        </div>
      ) : (
        list
      )}
    </div>
  );
}

// From the invoice to its claim — the figures, the records and the decision.
function ClaimLink({ claim }) {
  return (
    <Link to={`/billing/claims/${claim.id}`} style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.accentMid, textDecoration: "none" }}>
      Open the claim <FiArrowRight size={13} />
    </Link>
  );
}
