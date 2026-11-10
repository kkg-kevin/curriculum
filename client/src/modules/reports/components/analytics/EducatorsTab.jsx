import { useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiShield, FiStar, FiUsers } from "react-icons/fi";
import { Card, CsvButton, DataTable, Note, fmtNum } from "./ui";
import { BRAND as C, pill } from "../../../../theme/brand";
import Avatar from "../../../../components/ui/Avatar";
import { OVERALL, STATUS, formatValue, iconOf, shortOf } from "../../../mentor-standards/standards";

// Reports & Analytics → Educators (admins only; server: analytics.educators.js), redrawn to be read
// at a glance (10 Nov 2026): key figures as tiles, where the team stands on each mentor standard as
// stacked bars, who needs support as cards, every educator against every standard as a coloured
// scorecard, then the profile figures. Words only where a number needs one; hover for the detail.
// Click a name for their profile.

// One look per standing, shared by the bars, the chips and the scorecard.
const LOOK = {
  meets: { fill: C.mid, bg: C.skyTint, color: C.navy, label: "Meets" },
  close: { fill: C.gold, bg: C.goldTint, color: C.goldText, label: "Close" },
  below: { fill: C.danger, bg: C.dangerTint, color: C.danger, label: "Below" },
  grace: { fill: "#9BD7F2", bg: C.skyTint, color: C.skyText, label: "New" },
  not_enough: { fill: "#E5E7EB", bg: C.greyTint, color: C.faint, label: "No data yet" },
};
const ORDER = ["meets", "close", "below", "grace", "not_enough"];

const STYLE = `
.ed-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.ed-two { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; align-items: start; }
.ed-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.ed-score { width: 100%; border-collapse: separate; border-spacing: 4px; font-size: 12.5px; }
.ed-score th { font-weight: 700; color: ${C.muted}; vertical-align: bottom; padding: 0 2px 4px; }
.ed-score .ed-name { position: sticky; left: 0; z-index: 1; background: #fff; }
.ed-score td.cell { text-align: center; border-radius: 8px; font-weight: 800; padding: 7px 4px; min-width: 64px; white-space: nowrap; }
@media (max-width: 1000px) { .ed-two { display: flex; flex-direction: column; align-items: stretch; } }
@media (max-width: 760px) { .ed-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ed-cards { display: flex; flex-direction: column; } }
`;

// The educator's own profile photo; their initials only when they have none.
function Face({ x, size }) {
  const parts = String(x.name || "").split(/\s+/).filter(Boolean);
  return <Avatar firstName={parts[0]} lastName={parts.length > 1 ? parts[parts.length - 1] : ""} photo={x.photo} size={size} borderColor="#fff" />;
}
const targetShort = (sd) => `${sd.higherIsBetter === false ? "≤" : "≥"} ${formatValue(sd.target, sd.unit)}`;

function Kpi({ icon: Icon, label, value, tone = C.navy, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
      <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: `${tone}14`, color: tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={19} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{value}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</p>
        {children}
      </div>
    </div>
  );
}

function Legend({ keys = ORDER }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {keys.map((k) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: C.muted }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: LOOK[k].fill }} /> {LOOK[k].label}
        </span>
      ))}
    </div>
  );
}

// Each standard: how many educators meet it, are close, below, new, or without enough data yet.
function TeamBars({ standards, educators }) {
  return (
    <Card title="Where the team stands" action={<Legend />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {standards.map((sd) => {
          const Icon = iconOf(sd.key);
          const counts = Object.fromEntries(ORDER.map((k) => [k, 0]));
          for (const x of educators) {
            const it = x.standards?.items?.find((i) => i.key === sd.key);
            if (it) counts[it.status in counts ? it.status : "not_enough"] += 1;
          }
          const total = ORDER.reduce((n, k) => n + counts[k], 0) || 1;
          return (
            <div key={sd.key} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: C.canvas, color: C.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
              <div style={{ width: 132, flexShrink: 0, minWidth: 0 }}>
                <p title={sd.label} style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortOf(sd)}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: C.faint }}>{targetShort(sd)}</p>
              </div>
              <div role="img" aria-label={ORDER.filter((k) => counts[k]).map((k) => `${counts[k]} ${LOOK[k].label.toLowerCase()}`).join(", ")}
                style={{ flex: 1, minWidth: 80, display: "flex", height: 22, borderRadius: 7, overflow: "hidden", background: C.track }}>
                {ORDER.filter((k) => counts[k]).map((k) => (
                  <div key={k} title={`${counts[k]} ${LOOK[k].label.toLowerCase()}`}
                    style={{ width: `${(counts[k] / total) * 100}%`, background: LOOK[k].fill, color: k === "not_enough" || k === "close" || k === "grace" ? C.ink : "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", minWidth: 0 }}>
                    {counts[k] / total >= 0.09 ? counts[k] : ""}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// A standard an educator is short of: its icon and name, their figure on a bar, the standard's mark.
function ShortChip({ item }) {
  const Icon = iconOf(item.key);
  const top = item.unit === "★" ? 5 : 100;
  const bar = item.higherIsBetter !== false && item.value != null;
  return (
    <div title={`${item.label}: ${formatValue(item.value, item.unit)}, standard ${formatValue(item.target, item.unit)}`}
      style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <Icon size={13} color={C.danger} aria-hidden style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, width: 108, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortOf(item)}</span>
      {bar ? (
        <span aria-hidden style={{ position: "relative", flex: 1, height: 6, borderRadius: 999, background: C.track, minWidth: 40 }}>
          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, (Number(item.value) / top) * 100)}%`, borderRadius: 999, background: C.danger }} />
          <span style={{ position: "absolute", top: -3, height: 12, width: 2, borderRadius: 1, background: C.navy, left: `calc(${Math.min(100, (Number(item.target) / top) * 100)}% - 1px)` }} />
        </span>
      ) : <span style={{ flex: 1 }} />}
      <span style={{ fontSize: 12, fontWeight: 900, color: C.danger, whiteSpace: "nowrap" }}>{formatValue(item.value, item.unit)}</span>
    </div>
  );
}

function NeedsSupport({ educators, onOpen }) {
  const [all, setAll] = useState(false);
  const list = educators
    .filter((x) => x.standards?.overall === "below")
    .map((x) => ({ ...x, below: x.standards.items.filter((i) => i.status === "below") }))
    .sort((a, b) => b.below.length - a.below.length);
  const shown = all ? list : list.slice(0, 6);
  return (
    <Card title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><FiAlertTriangle color={C.danger} /> Needs support {list.length > 0 && <span style={pill("danger")}>{list.length}</span>}</span>}>
      {list.length === 0 ? (
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: C.navy }}><FiCheckCircle color={C.mid} /> No one is below a standard.</p>
      ) : (
        <>
          <div className="ed-cards">
            {shown.map((x) => (
              <button key={x.teacherId} type="button" onClick={() => onOpen(x.teacherId)}
                style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0, font: "inherit" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Face x={x} size={34} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</span>
                  <span title={`${x.standards.met} of ${x.standards.counted} standards met`} style={pill("neutral")}>{x.standards.met}/{x.standards.counted}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {x.below.map((i) => <ShortChip key={i.key} item={i} />)}
                </span>
              </button>
            ))}
          </div>
          {list.length > 6 && (
            <button type="button" className="an-link" onClick={() => setAll((v) => !v)} style={{ marginTop: 10, fontSize: 12.5 }}>
              {all ? "Show fewer" : `Show all ${list.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

// Every educator against every standard, one coloured tile each.
function Scorecard({ standards, educators, onOpen }) {
  const [all, setAll] = useState(false);
  const itemOf = (x, key) => x.standards?.items?.find((i) => i.key === key);
  const rows = [...educators].sort((a, b) => {
    const below = (x) => (x.standards?.items || []).filter((i) => i.status === "below").length;
    const ratio = (x) => (x.standards?.counted ? x.standards.met / x.standards.counted : 2);
    return below(b) - below(a) || ratio(a) - ratio(b) || a.name.localeCompare(b.name);
  });
  const shown = all ? rows : rows.slice(0, 15);
  const csvColumns = [
    { key: "name", label: "Educator", csv: (x) => x.name },
    { key: "met", label: "Met", csv: (x) => `${x.standards?.met ?? 0}/${x.standards?.counted ?? 0}` },
    ...standards.map((sd) => ({ key: sd.key, label: `${sd.label} (${formatValue(sd.target, sd.unit)})`, csv: (x) => itemOf(x, sd.key)?.value ?? "" })),
  ];
  return (
    <Card title="Scorecard" action={<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><Legend /><CsvButton filename="educators-standards.csv" columns={csvColumns} rows={rows} /></div>}>
      {rows.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No educator teaches in this scope.</p> : (
        <div className="an-table-wrap">
          <table className="ed-score">
            <thead>
              <tr>
                <th className="ed-name" style={{ textAlign: "left", minWidth: 150 }}>Educator</th>
                <th style={{ minWidth: 52 }}>Met</th>
                {standards.map((sd) => {
                  const Icon = iconOf(sd.key);
                  return (
                    <th key={sd.key} title={`${sd.label}: standard ${formatValue(sd.target, sd.unit)}`}>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <Icon size={15} color={C.navy} aria-hidden />
                        <span style={{ fontSize: 11, lineHeight: 1.2, maxWidth: 80, textAlign: "center" }}>{shortOf(sd)}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.faint }}>{targetShort(sd)}</span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.teacherId}>
                  <td className="ed-name" style={{ padding: "0 4px" }}>
                    <button type="button" className="an-link" onClick={() => onOpen(x.teacherId)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Face x={x} size={26} />
                      {x.name}
                    </button>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span title={(OVERALL[x.standards?.overall] || OVERALL.not_enough).label} style={pill((OVERALL[x.standards?.overall] || OVERALL.not_enough).tone)}>
                      {x.standards?.met ?? 0}/{x.standards?.counted ?? 0}
                    </span>
                  </td>
                  {standards.map((sd) => {
                    const it = itemOf(x, sd.key);
                    const look = LOOK[it?.status] || LOOK.not_enough;
                    const waiting = !it || it.status === "not_enough";
                    return (
                      <td key={sd.key} className="cell" title={it ? `${sd.label}: ${formatValue(it.value, it.unit)} · ${(STATUS[it.status] || STATUS.not_enough).label}${waiting ? ` (${it.evidence} of ${it.minEvidence} ${it.evidenceLabel})` : ""}` : sd.label}
                        style={{ background: look.bg, color: look.color, fontWeight: waiting ? 600 : 800 }}>
                        {it?.value == null ? "–" : formatValue(it.value, it.unit)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 15 && (
        <button type="button" className="an-link" onClick={() => setAll((v) => !v)} style={{ marginTop: 10, fontSize: 12.5 }}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </Card>
  );
}

export default function EducatorsTab({ data, links }) {
  if (data.hidden) return <Note>Per-educator figures are for your workspace&apos;s admins.</Note>;
  const t = data.totals || {};
  const standards = data.standards || [];
  const counted = data.educators.filter((x) => x.standards?.counted > 0).length;
  const share = counted ? Math.round((t.meetingAll / counted) * 100) : 0;

  return (
    <>
      <style>{STYLE}</style>
      <div className="ed-kpis">
        <Kpi icon={FiUsers} label="Educators" value={fmtNum(t.educators)} />
        <Kpi icon={FiCheckCircle} label="Meet every standard" value={counted ? <>{fmtNum(t.meetingAll)}<span style={{ fontSize: 14, color: C.faint }}> / {fmtNum(counted)}</span></> : "—"} tone={C.mid}>
          {counted > 0 && <div aria-hidden style={{ marginTop: 6, height: 5, borderRadius: 999, background: C.track }}><div style={{ width: `${share}%`, height: "100%", borderRadius: 999, background: C.mid }} /></div>}
        </Kpi>
        <Kpi icon={FiAlertTriangle} label="Need support" value={fmtNum(t.belowAny)} tone={t.belowAny ? C.danger : C.navy} />
        <Kpi icon={FiStar} label="Parent rating" value={t.rating != null ? `${t.rating}★` : "—"} tone="#B87708" />
        <Kpi icon={FiShield} label="Quality reviews" value={t.qa != null ? `${t.qa}%` : "—"} />
        <Kpi icon={FiClock} label="Hours, 90 days" value={fmtNum(t.hours90)} tone={C.sky} />
      </div>

      {standards.length > 0 && (
        <div className="ed-two">
          <TeamBars standards={standards} educators={data.educators} />
          <NeedsSupport educators={data.educators} onOpen={links.educator} />
        </div>
      )}

      {standards.length > 0 && <Scorecard standards={standards} educators={data.educators} onOpen={links.educator} />}

      <DataTable
        title="Profile figures"
        columns={[
          { key: "name", label: "Educator", render: (x) => <button type="button" className="an-link" onClick={() => links.educator(x.teacherId)}>{x.name}</button>, csv: (x) => x.name },
          { key: "rating", label: "Rating", align: "num", render: (x) => (x.rating == null ? "–" : `${x.rating.toFixed(1)}★ (${x.reviews})`), csv: (x) => x.rating, sort: (x) => x.smoothed ?? -1 },
          { key: "qa", label: "QA", align: "num", render: (x) => (x.qa == null ? "–" : `${x.qa}%`), sort: (x) => x.qa ?? -1 },
          { key: "hours", label: "Hours", align: "num", render: (x) => fmtNum(Math.round(x.hours)) },
          { key: "hours90", label: "90 days", align: "num", render: (x) => fmtNum(Math.round(x.hours90)) },
          { key: "learners", label: "Learners", align: "num" },
          { key: "reliability", label: "Held", align: "num", render: (x) => (x.reliability == null ? "–" : `${x.reliability}%`), sort: (x) => x.reliability ?? -1 },
          { key: "feedbackHours", label: "Marks in", align: "num", render: (x) => (x.feedbackHours == null ? "–" : `${Math.round(x.feedbackHours)} h`), sort: (x) => x.feedbackHours ?? 9999 },
          { key: "finished", label: "Finished", align: "num" },
          { key: "badges", label: "Badges", align: "num", render: (x) => (x.badges.length ? <span title={x.badges.join(", ")} style={pill("strong")}>{x.badges.length}</span> : "–"), csv: (x) => x.badges.join("; "), sort: (x) => x.badges.length },
          { key: "published", label: "Profile", render: (x) => <span style={pill(x.published ? "good" : "neutral")}>{x.published ? "Public" : "Private"}</span>, csv: (x) => (x.published ? "published" : "private") },
        ]}
        rows={data.educators}
        filename="educators-performance.csv"
        initialSort={{ key: "rating", dir: "desc" }}
        limit={15}
        empty="No educator teaches in this scope."
      />
    </>
  );
}
