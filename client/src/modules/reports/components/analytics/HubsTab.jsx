import { FiAlertTriangle, FiAward, FiCalendar, FiClock, FiHome, FiStar, FiUsers } from "react-icons/fi";
import { Card, CsvButton, Empty, Note, Stat, T, fmtNum } from "./ui";
import { levelFor } from "../../utils/reportView";

// Hubs side by side (10 Nov 2026, admins only; server analytics.hubs.js): every hub on the same
// figures for the period, one row each, so the one that needs support stands out. Each figure is a
// coloured tile: the weakest hub in a column is marked. "Focus" narrows every tab to that hub.

const MIN_FOR_COLOUR = 1;
// Good / middling / weak for a percentage (higher is better unless `lower`).
function band(v, { good, weak, lower = false }) {
  if (v == null) return "none";
  if (lower) return v <= good ? "good" : v >= weak ? "weak" : "mid";
  return v >= good ? "good" : v < weak ? "weak" : "mid";
}
const LOOK = {
  good: { bg: "#EAF6FD", color: "#25476a" },
  mid: { bg: "#FFF5E1", color: "#7A4F00" },
  weak: { bg: "#FEF2F2", color: "#B91C1C" },
  none: { bg: "#F3F4F6", color: "#9CA3AF" },
};

const COLUMNS = [
  { key: "attendance", label: "Attendance", icon: FiCalendar, fmt: (h) => (h.attendance == null ? "–" : `${h.attendance}%`), band: (h) => band(h.attendance, { good: 85, weak: 70 }), title: (h) => `${h.registered} register marks` },
  { key: "onTime", label: "On time", icon: FiClock, fmt: (h) => (h.onTime == null ? "–" : `${h.onTime}%`), band: (h) => band(h.onTime, { good: 75, weak: 50 }), title: (h) => `${h.timed} pieces with a due date` },
  { key: "score", label: "Average score", icon: FiAward, fmt: (h) => (h.score == null ? "–" : `${h.score}%`), band: (h) => (h.score == null ? "none" : ({ strong: "good", track: "good", starting: "mid", early: "weak" })[levelFor(h.score).key]), title: (h) => (h.score == null ? "Nothing marked" : levelFor(h.score).label) },
  { key: "atRiskPercent", label: "At risk", icon: FiAlertTriangle, fmt: (h) => (h.atRiskPercent == null ? "–" : `${h.atRiskPercent}%`), band: (h) => band(h.atRiskPercent, { good: 10, weak: 25, lower: true }), title: (h) => `${h.atRisk} of ${h.learners} learners` },
  { key: "rating", label: "Parent rating", icon: FiStar, fmt: (h) => (h.rating == null ? "–" : `${h.rating.toFixed(1)}★`), band: (h) => (h.reviews < MIN_FOR_COLOUR ? "none" : band(h.rating, { good: 4, weak: 3.5 })), title: (h) => `${h.reviews} reviews, last 12 months` },
];

export default function HubsTab({ data, onFocusHub }) {
  if (data.hidden) return <Note>Hubs are compared for your workspace&apos;s admins.</Note>;
  const hubs = data.hubs.filter((h) => h.learners > 0 || h.educators > 0);
  if (!hubs.length) return <Card><Empty>No hub has learners in this view.</Empty></Card>;
  const totalLearners = hubs.reduce((n, h) => n + h.learners, 0);
  const weakest = Object.fromEntries(COLUMNS.map((c) => {
    const known = hubs.filter((h) => h[c.key] != null);
    if (known.length < 2) return [c.key, null];
    const worst = [...known].sort((a, b) => (c.key === "atRiskPercent" ? b[c.key] - a[c.key] : a[c.key] - b[c.key]))[0];
    return [c.key, worst.hubId];
  }));
  const csv = [
    { key: "name", label: "Hub" }, { key: "learners", label: "Learners" }, { key: "educators", label: "Educators" },
    ...COLUMNS.map((c) => ({ key: c.key, label: c.label, csv: (h) => h[c.key] ?? "" })),
  ];

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiHome} label="Hubs with learners" value={fmtNum(hubs.filter((h) => h.learners).length)} />
        <Stat icon={FiUsers} label="Learners" value={fmtNum(totalLearners)} tone="mid" />
        <Stat icon={FiAlertTriangle} label="Hubs with 25%+ at risk" value={fmtNum(hubs.filter((h) => (h.atRiskPercent ?? 0) >= 25).length)} tone="danger" />
      </div>

      <Card title="Hubs side by side" action={<div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {[["good", "Strong"], ["mid", "Watch"], ["weak", "Needs support"], ["none", "No data"]].map(([k, l]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.muted }}><span style={{ width: 10, height: 10, borderRadius: 3, background: LOOK[k].bg, border: `1px solid ${LOOK[k].color}33` }} />{l}</span>
        ))}
        <CsvButton filename="hubs-side-by-side.csv" columns={csv} rows={hubs} />
      </div>}>
        <div className="an-table-wrap">
          <table className="ed-hubs" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4, fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", color: T.muted, fontWeight: 700, padding: "0 4px 4px", minWidth: 170 }}>Hub</th>
                <th style={{ color: T.muted, fontWeight: 700, padding: "0 4px 4px" }}>Learners</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} style={{ color: T.muted, fontWeight: 700, padding: "0 4px 4px", minWidth: 86 }}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><c.icon size={15} color={T.navy} aria-hidden />{c.label}</span>
                  </th>
                ))}
                <th aria-label="Focus" />
              </tr>
            </thead>
            <tbody>
              {hubs.map((h) => (
                <tr key={h.hubId}>
                  <td style={{ padding: "0 4px" }}>
                    <span style={{ display: "block", fontWeight: 800, color: T.ink }}>{h.name}</span>
                    <span style={{ fontSize: 11.5, color: T.faint }}>{h.educators} educator{h.educators === 1 ? "" : "s"}{h.online ? " · online" : ""}{h.status !== "active" ? ` · ${h.status}` : ""}</span>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 800, color: T.ink }}>{fmtNum(h.learners)}</td>
                  {COLUMNS.map((c) => {
                    const look = LOOK[c.band(h)];
                    const worst = weakest[c.key] === h.hubId;
                    return (
                      <td key={c.key} title={c.title(h)} style={{ textAlign: "center", borderRadius: 8, padding: "8px 4px", background: look.bg, color: look.color, fontWeight: 800, boxShadow: worst ? `inset 0 0 0 2px ${look.color}` : "none" }}>
                        {c.fmt(h)}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="an-link" onClick={() => onFocusHub(h.hubId)} style={{ fontSize: 12.5 }}>Focus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>A box marks the weakest hub in each column. Focus narrows every tab to that hub.</Note>
      </Card>
    </>
  );
}
