import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountBalance as AccountBalanceIcon, ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { useInvoicesQuery, useStatementQuery } from "../hooks/useBilling";
import { cardStyle, inputStyle, formatMoney, formatDate } from "../components/shared";
import BillToCard from "../components/BillToCard";
import BrandMark from "../components/BrandMark";
import DocumentActions from "../components/DocumentActions";
import { EmptyState, ErrorState } from "../components/PageStates";

const AGING_LABELS = { current: "Current", "1-30": "1–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90+": "90+ days" };

export default function StatementOfAccountPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLearner = user?.role === "learner";
  const basePath = isLearner ? "/learner-portal" : user?.role === "school" ? "/school-portal/billing" : "/billing";

  const { data: invoicesData } = useInvoicesQuery();
  const invoices = invoicesData?.data || [];

  const payerOptions = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      if (inv.payerHubId) {
        const key = `hub:${inv.payerHubId}`;
        if (!map.has(key)) map.set(key, { payerType: "hub", payerId: inv.payerHubId, label: inv.billTo?.name || "Learning hub" });
      } else if (inv.payerUserId) {
        const key = `user:${inv.payerUserId}`;
        if (!map.has(key)) map.set(key, { payerType: "user", payerId: inv.payerUserId, label: inv.billTo?.name || "Guardian account" });
      }
    }
    return [...map.values()];
  }, [invoices]);

  const [selectedKey, setSelectedKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const selected = isLearner
    ? { payerType: "user", payerId: user?.id }
    : payerOptions.find((opt) => `${opt.payerType}:${opt.payerId}` === selectedKey);

  const { data: statement, isError } = useStatementQuery(selected?.payerType, selected?.payerId, { from, to });

  const statementFilename = statement ? `Statement-${(statement.billTo?.name || "account").replace(/[^a-z0-9]+/gi, "-")}-${formatDate(statement.to).replace(/\s+/g, "")}.pdf` : "Statement.pdf";

  return (
    <div id="statement-document" style={{ fontFamily: "Inter, sans-serif", color: "#111827", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" className="no-print" onClick={() => navigate(basePath)} style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><ArrowBackIcon sx={{ fontSize: 17 }} /> Back to billing</button>

      <section style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 52%, #2e7db5 100%)", borderRadius: 18, padding: "24px 28px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <BrandMark />
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 14 }}><AccountBalanceIcon sx={{ fontSize: 16 }} /> Statement of account</div>
          <h1 style={{ margin: "8px 0 5px", fontSize: 24, fontWeight: 900 }}>{isLearner ? "My statement" : statement?.billTo?.name || "Select a payer"}</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,.74)", fontSize: 13 }}>{statement ? `${formatDate(statement.from)} – ${formatDate(statement.to)}` : "A running ledger of every invoice and payment for one payer."}</p>
        </div>
        {statement && <DocumentActions kind="statement" doc={statement} targetId="statement-document" filename={statementFilename} />}
      </section>

      <section className="no-print" style={{ ...cardStyle, padding: "16px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        {!isLearner && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151", minWidth: 220 }}>
            Payer
            <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} style={inputStyle}>
              <option value="">Select a payer…</option>
              {payerOptions.map((opt) => <option key={`${opt.payerType}:${opt.payerId}`} value={`${opt.payerType}:${opt.payerId}`}>{opt.label}</option>)}
            </select>
          </label>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} /></label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} /></label>
        {!isLearner && !payerOptions.length && <span style={{ fontSize: 12, color: "#9CA3AF" }}>No billed payers found yet.</span>}
      </section>

      {!selected?.payerId ? (
        <section style={cardStyle}><EmptyState icon={AccountBalanceIcon} title="Choose a payer" subtitle="Select a payer above to generate their statement of account." /></section>
      ) : isError ? (
        <ErrorState label="Statement could not be loaded." detail="Please try selecting the payer again." />
      ) : !statement ? (
        <section style={cardStyle}><EmptyState icon={AccountBalanceIcon} title="Generating statement…" /></section>
      ) : (
        <>
          <BillToCard billTo={statement.billTo} label="Statement for" />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "Opening balance", value: statement.openingBalance, color: "#25476a" },
              { label: "Total invoiced", value: statement.totalInvoiced, color: "#1D4ED8" },
              { label: "Total paid", value: statement.totalPaid, color: "#047857" },
              { label: "Closing balance", value: statement.closingBalance, color: statement.closingBalance > 0 ? "#C2410C" : "#047857" },
            ].map((stat) => (
              <div key={stat.label} style={{ ...cardStyle, padding: "14px 16px" }}>
                <div style={{ fontSize: 18, fontWeight: 850, color: stat.color, fontVariantNumeric: "tabular-nums" }}>{formatMoney(stat.value)}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <section style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ padding: "17px 22px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Running ledger</h2>
              {statement.ledger.length > 0 && <span className="no-print" style={{ fontSize: 11.5, color: "#9CA3AF" }}>{statement.ledger.length} entr{statement.ledger.length === 1 ? "y" : "ies"} · scroll for more</span>}
            </div>
            <div className="scroll-box" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead><tr>{["Date", "Reference", "Description", "Debit", "Credit", "Balance"].map((h) => <th key={h} style={{ position: "sticky", top: 0, background: "#fff", padding: "11px 22px", textAlign: ["Debit", "Credit", "Balance"].includes(h) ? "right" : "left", color: "#9CA3AF", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #EEF1F5" }}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr><td colSpan={5} style={{ padding: "10px 22px", fontSize: 12, color: "#6B7280", fontStyle: "italic" }}>Opening balance</td><td style={{ padding: "10px 22px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>{formatMoney(statement.openingBalance)}</td></tr>
                  {statement.ledger.length === 0 && <tr><td colSpan={6} style={{ padding: "20px 22px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No activity in this period.</td></tr>}
                  {statement.ledger.map((line, i) => (
                    <tr key={i}>
                      <td style={{ padding: "12px 22px", fontSize: 13, color: "#6B7280" }}>{formatDate(line.date)}</td>
                      <td style={{ padding: "12px 22px", fontSize: 13, color: "#374151" }}>{line.reference}</td>
                      <td style={{ padding: "12px 22px", fontSize: 13, color: "#6B7280", textTransform: "capitalize" }}>{line.description}</td>
                      <td style={{ padding: "12px 22px", textAlign: "right", fontSize: 13, color: "#C2410C" }}>{line.debit > 0 ? formatMoney(line.debit) : ""}</td>
                      <td style={{ padding: "12px 22px", textAlign: "right", fontSize: 13, color: "#047857" }}>{line.credit > 0 ? formatMoney(line.credit) : ""}</td>
                      <td style={{ padding: "12px 22px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#25476a" }}>{formatMoney(line.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody><tr><td style={{ padding: "12px 22px", fontSize: 13, fontWeight: 800, borderTop: "1px solid #E5E7EB", width: "100%" }}>Closing balance</td><td style={{ padding: "12px 22px", textAlign: "right", fontSize: 14, fontWeight: 850, color: "#25476a", borderTop: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{formatMoney(statement.closingBalance)}</td></tr></tbody></table>
          </section>

          <section style={{ ...cardStyle, padding: "20px 22px" }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>Aging summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
              {Object.entries(statement.aging).map(([bucket, amount]) => (
                <div key={bucket} style={{ padding: "12px 14px", borderRadius: 10, background: bucket === "current" ? "#F1F9FD" : Number(amount) > 0 ? "#FEF2F2" : "#F9FAFB", textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: bucket === "current" ? "#25476a" : Number(amount) > 0 ? "#B91C1C" : "#9CA3AF" }}>{formatMoney(amount)}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{AGING_LABELS[bucket] || bucket}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
