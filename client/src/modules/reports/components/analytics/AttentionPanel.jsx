import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiArrowRight, FiCalendar, FiCheckCircle, FiCreditCard, FiEdit3, FiEyeOff, FiFlag, FiInbox, FiTarget } from "react-icons/fi";
import { useAnalytics } from "../../hooks/useAnalytics";
import { T } from "./ui";

// "Needs your attention" (10 Nov 2026) — the top of the Overview tab: one short list of what wants
// doing, from every tab (server: analytics.attention.js), each opening where it's fixed. The same
// list goes out in the Monday summary email.

const ICON = { edit: FiEdit3, alert: FiAlertTriangle, calendar: FiCalendar, eye: FiEyeOff, target: FiTarget, flag: FiFlag, card: FiCreditCard, inbox: FiInbox };
const TONE = {
  danger: { color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  waiting: { color: "#7A4F00", bg: "#FFF5E1", border: "#FDD89A" },
  info: { color: "#1F6F9E", bg: "#EAF6FD", border: "#BFE3F7" },
};

export default function AttentionPanel({ onTab }) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAnalytics("attention", {});
  const items = data?.items || [];

  return (
    <section style={{ background: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 900, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
          <FiFlag color={T.navy} /> Needs your attention
          {items.length > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 999, padding: "1px 9px" }}>{items.length}</span>}
        </h2>
      </div>
      {isLoading ? <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Checking…</p>
        : isError ? <p style={{ margin: 0, fontSize: 13, color: T.muted }}>This list couldn&apos;t be loaded.</p>
          : items.length === 0 ? (
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.navy }}>
              <FiCheckCircle color={T.mid} /> All clear. Nothing needs you right now.
            </p>
          ) : (
            <div className="an-attn" style={{ display: "grid", gap: 10 }}>
              {items.map((item) => {
                const Icon = ICON[item.icon] || FiFlag;
                const tone = TONE[item.tone] || TONE.info;
                const go = item.tab ? () => onTab(item.tab) : item.path ? () => navigate(item.path) : null;
                return (
                  <button key={item.key} type="button" onClick={go || undefined} disabled={!go}
                    style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1px solid ${tone.border}`, background: tone.bg, cursor: go ? "pointer" : "default", font: "inherit", minWidth: 0 }}>
                    <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, background: "#fff", color: tone.color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={18} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, color: T.ink }}>
                        <strong style={{ fontSize: 18, fontWeight: 900, color: tone.color, marginRight: 6 }}>{item.count}</strong>{item.label}
                      </span>
                      {item.detail && <span style={{ display: "block", fontSize: 12, color: T.muted, marginTop: 1 }}>{item.detail}</span>}
                    </span>
                    {go && <FiArrowRight size={16} color={tone.color} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
      <style>{".an-attn { grid-template-columns: repeat(2, minmax(0, 1fr)); } @media (max-width: 760px) { .an-attn { display: flex !important; flex-direction: column; } }"}</style>
    </section>
  );
}
