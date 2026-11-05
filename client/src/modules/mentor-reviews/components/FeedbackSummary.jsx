import { StarsShown } from "./Stars";

// The averages part of an educator's parent feedback — overall, each aspect as a bar, and how the
// stars spread. Shared by the staff section, the educator's own page and the hub's view.
export default function FeedbackSummary({ summary }) {
  const max = Math.max(1, ...(summary.distribution || []).map((d) => d.count));
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#111827", lineHeight: 1 }}>{summary.average != null ? summary.average.toFixed(1) : "—"}<span style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}> / 5</span></p>
          <div style={{ marginTop: 6 }}><StarsShown value={summary.average} showNumber={false} size={17} /></div>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#6B7280" }}>{summary.count} review{summary.count === 1 ? "" : "s"}</p>
        </div>
        <div style={{ display: "grid", gap: 4, gridTemplateColumns: "100%" }}>
          {(summary.distribution || []).map((d) => (
            <div key={d.stars} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#4B5563" }}>
              <span style={{ width: 14, textAlign: "right" }}>{d.stars}</span>
              <span style={{ flex: 1, height: 7, borderRadius: 999, background: "#EEF0F4", overflow: "hidden" }}><span style={{ display: "block", width: `${(d.count / max) * 100}%`, height: "100%", background: "#feb139" }} /></span>
              <span style={{ width: 22, color: "#9CA3AF" }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%", alignContent: "start" }}>
        {(summary.aspects || []).map((a) => (
          <div key={a.key}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>{a.label}</span>
              <span style={{ fontWeight: 800, color: "#25476a" }}>{a.average != null ? a.average.toFixed(1) : "—"}</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: "#EEF0F4", overflow: "hidden" }}><div style={{ width: `${((a.average || 0) / 5) * 100}%`, height: "100%", background: "#2e7db5", borderRadius: 999 }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
