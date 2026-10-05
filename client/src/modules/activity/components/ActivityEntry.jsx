import { useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { accountLabel, areaLabel, browserOf, timeOf, tone } from "../labels";

// One line of the activity log: when, who, what. Opens to show exactly what changed (before →
// after) and where it was done from. `compact` drops the person's account type and the area tag,
// for a record's own History panel where space is tight and the area is already known.
export default function ActivityEntry({ entry, compact = false, showDate = false }) {
  const [open, setOpen] = useState(false);
  const t = tone(entry);
  const changes = entry.changes || [];
  const hasDetail = changes.length > 0 || entry.reason || entry.ip;
  const when = showDate ? new Date(entry.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : timeOf(entry.createdAt);

  return (
    <div style={{ borderTop: "1px solid #F3F4F6" }}>
      <button
        type="button" onClick={() => hasDetail && setOpen((v) => !v)} aria-expanded={hasDetail ? open : undefined}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "11px 4px", border: "none", background: "none", textAlign: "left", fontFamily: "Inter, sans-serif", cursor: hasDetail ? "pointer" : "default" }}
      >
        <span style={{ width: showDate ? 132 : 52, flexShrink: 0, fontSize: 12, color: "#9CA3AF", paddingTop: 2, fontVariantNumeric: "tabular-nums" }}>{when}</span>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: t.color, flexShrink: 0, marginTop: 6 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, color: "#111827", lineHeight: 1.45 }}>
            <strong style={{ fontWeight: 700 }}>{entry.actorName || "Unknown"}</strong>{" "}
            <span style={{ color: "#374151" }}>{entry.summary ? entry.summary[0].toLowerCase() + entry.summary.slice(1) : ""}</span>
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
            {t.label && <span style={{ fontSize: 10.5, fontWeight: 800, color: t.color, background: t.background, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.label}</span>}
            {!compact && <span style={{ fontSize: 11.5, color: "#6B7280" }}>{accountLabel(entry)}</span>}
            {!compact && entry.module && <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", borderRadius: 999, padding: "1px 8px" }}>{areaLabel(entry.module)}</span>}
            {changes.length > 0 && <span style={{ fontSize: 11.5, color: "#25476a", fontWeight: 600 }}>{changes.length} {changes.length === 1 ? "change" : "changes"}</span>}
          </span>
        </span>
        {hasDetail && <span style={{ color: "#9CA3AF", paddingTop: 3 }}>{open ? <FiChevronDown size={15} /> : <FiChevronRight size={15} />}</span>}
      </button>

      {open && (
        <div style={{ margin: "0 4px 12px", marginLeft: (showDate ? 132 : 52) + 37, padding: "12px 14px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
          {entry.reason && <p style={{ margin: "0 0 10px", fontSize: 12.5, color: t.color, fontWeight: 600 }}>{entry.reason}</p>}
          {changes.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: entry.ip ? 10 : 0 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#9CA3AF", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <th style={{ padding: "0 10px 6px 0", fontWeight: 700, width: "26%" }}>Field</th>
                  <th style={{ padding: "0 10px 6px 0", fontWeight: 700, width: "37%" }}>Before</th>
                  <th style={{ padding: "0 0 6px", fontWeight: 700 }}>After</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change, index) => (
                  <tr key={`${change.field}-${index}`} style={{ borderTop: "1px solid #EEF0F3", verticalAlign: "top" }}>
                    <td style={{ padding: "6px 10px 6px 0", fontWeight: 600, color: "#374151" }}>{change.field}</td>
                    <td style={{ padding: "6px 10px 6px 0", color: "#6B7280", wordBreak: "break-word" }}>{change.from}</td>
                    <td style={{ padding: "6px 0", color: "#111827", wordBreak: "break-word" }}>{change.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
            {[entry.actorEmail, entry.ip && `from ${entry.ip}`, browserOf(entry.userAgent), new Date(entry.createdAt).toLocaleString()].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
