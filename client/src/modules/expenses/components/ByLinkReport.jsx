import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiDownload, FiLink2, FiPieChart } from "react-icons/fi";
import { BRAND, FONT, card, cardHeading } from "../../../theme/brand";
import { LINK_PATHS, expensesApi, formatMoney, kenyaToday } from "../services/expensesApi";
import { btn, hint } from "./ui";

// Finance → Expenses → "What it was for": the team's claimed money (sent claims only) by what each
// expense was linked to — per kind (Home Learning families, classes, bootcamps…) and per record,
// with what's still standing after review and what's been paid back. Lines not linked to anything
// show as "Not said", so it's plain how much can't be traced to a record.

const PERIODS = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Last 3 months" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

function rangeOf(key) {
  const today = kenyaToday();
  if (key === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (key === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (key === "quarter") {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 3);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  return {};
}

function downloadCsv(rows, currency) {
  const head = ["What it was for", "Record", `Claimed (${currency})`, `Approved (${currency})`, `Paid (${currency})`, "Expenses", "Claims", "People"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) => [r.typeLabel, r.linkLabel || (r.linkType === "general" ? "General work" : "—"), r.claimed, r.approved, r.paid, r.lines, r.claims, r.people].map(esc).join(","));
  const blob = new Blob([[head.map(esc).join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `expenses-by-what-for-${kenyaToday()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ByLinkReport() {
  const [period, setPeriod] = useState("quarter");
  const [kind, setKind] = useState("");
  const range = rangeOf(period);
  const { data, isLoading } = useQuery({ queryKey: ["expenses", "by-link", range], queryFn: () => expensesApi.byLink(range) });
  const rows = useMemo(() => (data?.records || []).filter((r) => !kind || (r.linkType || "none") === kind), [data, kind]);
  if (isLoading || !data) return <p style={hint}>Loading…</p>;
  const { kinds, total, linked, currency } = data;
  const max = Math.max(1, ...kinds.map((k) => k.claimed));
  const share = total ? Math.round((linked / total) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%", fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div role="group" aria-label="Period" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}
              style={{ ...btn, background: period === p.key ? BRAND.navy : "#fff", color: period === p.key ? "#fff" : BRAND.inkSoft, borderColor: period === p.key ? BRAND.navy : BRAND.border }}>{p.label}</button>
          ))}
        </div>
        <button type="button" style={{ ...btn, marginLeft: "auto" }} onClick={() => downloadCsv(rows, currency)} disabled={!rows.length}><FiDownload size={14} /> Spreadsheet</button>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
        {[["Claimed", formatMoney(total, currency), "sent claims, any stage"], ["Linked to a record", `${share}%`, `${formatMoney(linked, currency)} says what it was for`], ["Records with spending", String(kinds.reduce((n, k) => n + k.records, 0)), "families, classes, events…"]].map(([k, v, sub]) => (
          <div key={k} style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.ink }}>{v}</div>
            <div style={{ fontSize: 12, color: BRAND.muted }}>{sub}</div>
          </div>
        ))}
      </div>

      {kinds.length === 0 ? <p style={hint}>No expenses claimed in this period.</p> : (
        <>
          <section style={{ ...card, padding: 18, display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
            <h3 style={cardHeading}><FiPieChart size={13} /> By kind</h3>
            {kinds.map((k) => {
              const key = k.linkType || "none";
              const on = kind === key;
              return (
                <button key={key} type="button" aria-pressed={on} onClick={() => setKind(on ? "" : key)}
                  style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(120px, 220px) minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "4px 6px", borderRadius: 8, background: on ? BRAND.skyTint : "transparent" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: k.linkType ? BRAND.ink : BRAND.muted }}>{k.typeLabel}{k.records ? <span style={{ color: BRAND.muted, fontWeight: 500 }}> · {k.records}</span> : null}</span>
                  <span style={{ height: 10, borderRadius: 999, background: BRAND.greyTint, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${(k.claimed / max) * 100}%`, background: k.linkType ? BRAND.mid : BRAND.faint, borderRadius: 999 }} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, whiteSpace: "nowrap" }}>{formatMoney(k.claimed, currency)}</span>
                </button>
              );
            })}
            <p style={hint}>Tap a kind to list only its records.</p>
          </section>

          <section style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: "left", color: BRAND.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {["What it was for", "Claimed", "Approved", "Paid back", "Claims", "People"].map((h, i) => <th key={h} style={{ padding: "12px 14px", textAlign: i ? "right" : "left", fontWeight: 800 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const path = r.linkId && LINK_PATHS[r.linkType]?.(r.linkId);
                  const name = r.linkLabel || (r.linkType === "general" ? "General work" : "Not linked to anything");
                  return (
                    <tr key={`${r.linkType}:${r.linkId}`} style={{ borderTop: `1px solid ${BRAND.line}` }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontWeight: 700, color: BRAND.ink }}>{path ? <Link to={path} style={{ color: BRAND.ink, display: "inline-flex", alignItems: "center", gap: 5 }}><FiLink2 size={12} color={BRAND.mid} /> {name}</Link> : name}</div>
                        <div style={{ fontSize: 12, color: BRAND.muted }}>{r.typeLabel}</div>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800 }}>{formatMoney(r.claimed, currency)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{formatMoney(r.approved, currency)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{formatMoney(r.paid, currency)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{r.claims}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>{r.people}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
