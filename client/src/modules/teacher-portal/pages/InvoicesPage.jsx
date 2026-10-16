import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiSearch } from "react-icons/fi";
import { useMyClaims } from "../../claims/hooks/useClaims";
import { ClaimStatusPill, T, TYPE_LABEL, cardStyle, claimBasis, formatDate, formatMoney } from "../../claims/shared";
import { ClaimInvoiceLinks } from "../../claims/components/ClaimCard";
import { InvoicePanel, useSideBySide } from "../../claims/components/ClaimInvoiceViewer";

// Every invoice the educator has sent — one per claim, each with its two documents: the claim
// invoice the system generated, and the eTIMS invoice they uploaded. Newest first; filter by where
// the claim stands, or search by course, class, hub or invoice number.
const FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "In review", statuses: ["pending_supervisor", "pending_admin"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "paid", label: "Paid", statuses: ["paid"] },
  { key: "rejected", label: "Declined", statuses: ["rejected"] },
];

function Total({ label, value, tone }) {
  return (
    <div style={{ ...cardStyle, padding: "14px 16px" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 900, color: tone || T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

export default function InvoicesPage({ embedded = false }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useMyClaims();
  const { selectedHubId } = useOutletContext() || {};
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null); // { id, kind: "claim" | "etims" }
  const wide = useSideBySide();
  // The hub picked at the top of the portal — its invoices only.
  const claims = useMemo(() => (data?.claims || []).filter((c) => !selectedHubId || c.hubId === selectedHubId), [data, selectedHubId]);

  const counts = useMemo(() => {
    const out = {};
    for (const f of FILTERS) out[f.key] = f.statuses ? claims.filter((c) => f.statuses.includes(c.status)).length : claims.length;
    return out;
  }, [claims]);

  const shown = useMemo(() => {
    const statuses = FILTERS.find((f) => f.key === filter)?.statuses;
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return claims.filter((c) => {
      if (statuses && !statuses.includes(c.status)) return false;
      const text = [c.claimNumber, c.courseName, c.className, c.hubName, c.invoiceFilename].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [claims, filter, search]);
  const viewed = viewing ? claims.find((c) => c.id === viewing.id) || null : null;
  const closeViewer = () => setViewing(null);

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading your invoices…</p>;
  if (isError) {
    return (
      <div style={{ ...cardStyle, fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Your invoices couldn&apos;t be loaded</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
      </div>
    );
  }

  const currency = claims[0]?.currency || "KES";
  const money = (value) => formatMoney(value, currency);
  const sum = (statuses) => claims.filter((c) => statuses.includes(c.status)).reduce((total, c) => total + c.amount, 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        {!embedded && <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>My Invoices</h1>}
        <p style={{ margin: embedded ? 0 : "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>
          Every invoice you&apos;ve sent with a claim — the claim invoice the system made, and your eTIMS invoice.
        </p>
      </div>

      {claims.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <Total label="In review" value={money(sum(["pending_supervisor", "pending_admin"]))} tone="#B45309" />
          <Total label="Approved, to be paid" value={money(sum(["approved"]))} tone="#0F766E" />
          <Total label="Paid" value={money(sum(["paid"]))} tone="#047857" />
        </div>
      )}

      {claims.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div role="tablist" aria-label="Filter invoices" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.filter((f) => f.key === "all" || f.key === filter || counts[f.key]).map((f) => {
              const active = filter === f.key;
              return (
                <button key={f.key} type="button" role="tab" aria-selected={active} onClick={() => setFilter(f.key)} style={{ padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", border: `1.5px solid ${active ? T.accent : T.border}`, background: active ? T.accent : "#fff", color: active ? "#fff" : T.inkMuted }}>
                  {f.label} <span style={{ opacity: 0.75 }}>({counts[f.key] || 0})</span>
                </button>
              );
            })}
          </div>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
            <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by course, class, hub or number…" aria-label="Search invoices" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" }} />
          </div>
        </div>
      )}

      {claims.length === 0 ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
          <FiFileText size={28} color={T.inkFaint} />
          <p style={{ margin: "10px 0 4px", fontSize: 15, fontWeight: 800, color: T.ink }}>No invoices yet</p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: T.inkMuted }}>An invoice is made each time you request payment for a course.</p>
          <button type="button" onClick={() => navigate("/teacher-portal/claims")} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Go to Claims
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p style={{ ...cardStyle, margin: 0, padding: "28px 20px", textAlign: "center", fontSize: 13.5, color: T.inkMuted }}>No invoices match.</p>
      ) : viewed && !wide ? (
        // Narrow screen: the invoice takes the page, with a way back to the list.
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={closeViewer} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", color: T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            <FiArrowLeft size={14} /> All invoices
          </button>
          <div style={{ height: "78vh" }}>
            <InvoicePanel claim={viewed} kind={viewing.kind} onKind={(kind) => setViewing({ id: viewed.id, kind })} onClose={closeViewer} />
          </div>
        </div>
      ) : (
        <div style={viewed ? { display: "grid", gridTemplateColumns: "minmax(320px, 400px) minmax(0, 1fr)", gap: 16, alignItems: "start" } : undefined}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {shown.map((c) => (
            <div key={c.id} style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: viewed ? 10 : 16, flexWrap: "wrap", ...(viewed?.id === c.id ? { borderColor: T.accent, boxShadow: `0 0 0 1px ${T.accent}` } : null) }}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: T.inkFaint }}>{c.claimNumber} · {formatDate(c.createdAt)}</p>
                <p style={{ margin: "2px 0 0", fontSize: 14.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.courseName}</p>
                <p style={{ margin: "1px 0 0", fontSize: 12.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[c.className, c.hubName].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div style={{ flex: "0 1 220px", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{formatMoney(c.amount, c.currency)}</p>
                <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted }}>{TYPE_LABEL[c.type]} · {claimBasis(c)}</p>
              </div>
              <div style={{ flex: "0 0 auto" }}>
                <ClaimStatusPill status={c.status} size="small" />
              </div>
              <div style={{ flex: viewed ? "1 1 100%" : "0 0 auto", marginLeft: viewed ? -10 : "auto" }}>
                <ClaimInvoiceLinks claim={c} onView={(kind) => setViewing({ id: c.id, kind })} active={viewed?.id === c.id ? viewing.kind : null} />
              </div>
            </div>
          ))}
        </div>
        {viewed && (
          // Stays in view while the list scrolls.
          <div style={{ position: "sticky", top: 16, height: "calc(100vh - 120px)", minHeight: 420 }}>
            <InvoicePanel claim={viewed} kind={viewing.kind} onKind={(kind) => setViewing({ id: viewed.id, kind })} onClose={closeViewer} />
          </div>
        )}
        </div>
      )}
    </div>
  );
}
