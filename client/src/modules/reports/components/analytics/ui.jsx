import { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiDownload, FiMinus } from "react-icons/fi";

/*
 * Shared pieces for the Reports & Analytics tabs: cards, stat tiles with a "vs previous period"
 * change, plain-HTML bars (every bar has a visible value and a hover title), the four-level
 * stacked bar, a weekday × hour heatmap, and a sortable table with a CSV download.
 * Text always wears ink colours; colour only marks identity (the four levels) or magnitude.
 */

export const T = {
  navy: "#25476a", navyDeep: "#1a3550", mid: "#2e7db5", sky: "#38aae1",
  ink: "#111827", muted: "#5B6475", faint: "#8C94A3", border: "#E5E7EB", track: "#EEF0F4", surface: "#fff", tint: "#F5F8FC",
};

// The report's four level words, in the system colours (the same fills as the learner report,
// reports/utils/reportView.js): gold → light sky → mid blue → navy. Neighbours are told apart
// with or without colour vision; every bar also carries its numbers.
export const LEVELS = [
  { key: "early", label: "Early days", range: "0–39%", fill: "#feb139" },
  { key: "starting", label: "Getting started", range: "40–59%", fill: "#9BD7F2" },
  { key: "track", label: "On track", range: "60–79%", fill: "#2e7db5" },
  { key: "strong", label: "Strong start", range: "80–100%", fill: "#25476a" },
];

export const fmtNum = (n) => (n == null ? "—" : Number(n).toLocaleString("en-KE"));
export const fmtPct = (n) => (n == null ? "—" : `${n}%`);
export function fmtHours(h) {
  if (h == null || !Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export const STYLES = `
.an { font-family: Inter, sans-serif; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.an-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.an-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
.an-three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
.an-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.an-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.an-table th { text-align: left; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: ${T.faint}; padding: 8px 10px; border-bottom: 1px solid ${T.border}; white-space: nowrap; cursor: pointer; user-select: none; }
.an-table td { padding: 9px 10px; border-bottom: 1px solid ${T.border}; color: ${T.ink}; vertical-align: middle; }
.an-table tr:last-child td { border-bottom: none; }
.an-table td.num, .an-table th.num { text-align: right; white-space: nowrap; }
.an-link { background: none; border: none; padding: 0; color: ${T.mid}; font: inherit; font-weight: 700; cursor: pointer; text-align: left; }
.an-link:hover { text-decoration: underline; }
.an button { font-family: inherit; }
@media (max-width: 1100px) { .an-three { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .an-two, .an-three { display: flex; flex-direction: column; } .an-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

export function Card({ title, subtitle, action, children, style }) {
  return (
    <section style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "16px 18px", minWidth: 0, ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.ink }}>{title}</h3>}
            {subtitle && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// The change since the previous period, in words and an arrow — never colour alone.
export function Delta({ now, before, suffix = "", betterWhenLower = false, label = "vs previous period" }) {
  if (now == null || before == null) return <span style={{ fontSize: 11.5, color: T.faint }}>No earlier figure</span>;
  if (before === 0 && now > 0 && !suffix) return <span style={{ fontSize: 11.5, color: T.faint }}>None in the previous period</span>;
  const diff = Math.round((now - before) * 10) / 10;
  const Icon = diff === 0 ? FiMinus : diff > 0 ? FiArrowUp : FiArrowDown;
  const good = diff === 0 ? null : betterWhenLower ? diff < 0 : diff > 0;
  const color = good == null ? T.faint : good ? T.mid : "#B87708";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: T.muted }}>
      <Icon size={12} color={color} aria-hidden />
      {diff > 0 ? "+" : ""}{fmtNum(diff)}{suffix} {label}
    </span>
  );
}

// A key figure (10 Nov 2026 — every tab): an icon in a soft tile, the number large, a short label
// under it, then an optional short note and the change since the previous period. `tone` colours
// the icon (navy by default; "danger" / "gold" / "mid" / "sky" / "good" for meaning).
const TILE_TONES = { navy: T.navy, mid: T.mid, sky: T.sky, gold: "#B87708", danger: "#B91C1C", good: T.mid };
export function Stat({ label, value, sub, delta, icon: Icon, tone = "navy" }) {
  const color = TILE_TONES[tone] || T.navy;
  return (
    <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, padding: "14px 16px", minWidth: 0, height: "100%", boxSizing: "border-box", display: "flex", gap: 12, alignItems: "flex-start" }}>
      {Icon && <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, background: `${color}14`, color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={18} /></span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink, lineHeight: 1.15 }}>{value}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: T.muted }}>{label}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.faint, lineHeight: 1.4 }}>{sub}</p>}
        {delta && <div style={{ marginTop: 4 }}>{delta}</div>}
      </div>
    </div>
  );
}

// Twelve months of one figure as a line (Trends, Hubs): the latest value large with its change on
// last month, the line underneath, months on hover. Gaps where a month has no data.
export function TrendLine({ points, valueKey, label, icon: Icon, format = (v) => `${v}%`, suffix = " pts", color = T.navy, betterWhenLower = false, max = 100 }) {
  const values = points.map((p) => p[valueKey]);
  const known = values.map((v, i) => [v, i]).filter(([v]) => v != null);
  const last = known.length ? known[known.length - 1] : null;
  const prev = known.length > 1 ? known[known.length - 2] : null;
  const top = max ?? Math.max(1, ...known.map(([v]) => v));
  const W = 300; const H = 70; const step = points.length > 1 ? W / (points.length - 1) : W;
  const y = (v) => H - (Math.min(top, v) / top) * (H - 6) - 3;
  let path = "";
  values.forEach((v, i) => { if (v == null) return; path += `${path && values[i - 1] != null ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)} `; });
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {Icon && <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, background: `${color}14`, color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} /></span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.muted }}>{label}</p>
          <p style={{ margin: 0, fontSize: 21, fontWeight: 900, color: T.ink, lineHeight: 1.15 }}>{last ? format(last[0]) : "—"}</p>
        </div>
        {last && prev && <Delta now={last[0]} before={prev[0]} suffix={suffix} betterWhenLower={betterWhenLower} label="on last month" />}
      </div>
      {known.length ? (
        <svg viewBox={`0 -2 ${W} ${H + 4}`} preserveAspectRatio="none" style={{ width: "100%", height: 72, display: "block", overflow: "visible" }} role="img" aria-label={`${label} by month`}>
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {values.map((v, i) => (v == null ? null : (
            <circle key={i} cx={i * step} cy={y(v)} r="3.2" fill="#fff" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke">
              <title>{`${points[i].label}: ${format(v)}`}</title>
            </circle>
          )))}
        </svg>
      ) : <Empty>No data in these months yet.</Empty>}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.faint, marginTop: 4 }}>
        <span>{points[0]?.label}</span><span>{points[points.length - 1]?.label}</span>
      </div>
    </Card>
  );
}

export function Empty({ children }) {
  return <p style={{ margin: 0, padding: "18px 4px", fontSize: 13, color: T.muted, textAlign: "center" }}>{children}</p>;
}

export function Note({ children }) {
  return <p style={{ margin: "10px 0 0", fontSize: 12, color: T.faint, lineHeight: 1.5 }}>{children}</p>;
}

// Horizontal bars, one per row: label, bar, value. `max` defaults to the biggest value.
export function BarList({ rows, max, color = T.mid, format = fmtNum, empty = "Nothing yet." }) {
  if (!rows?.length) return <Empty>{empty}</Empty>;
  const top = max ?? Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((r) => (
        <div key={r.key || r.label} title={`${r.label}: ${format(r.value)}`} style={{ display: "grid", gridTemplateColumns: "100%", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
            <span style={{ color: T.ink, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span style={{ color: T.ink, fontWeight: 800, flexShrink: 0 }}>{format(r.value)}{r.extra ? <span style={{ color: T.faint, fontWeight: 600 }}> · {r.extra}</span> : null}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: T.track, overflow: "hidden" }}>
            <div style={{ width: `${top > 0 ? Math.max(r.value > 0 ? 1.5 : 0, ((r.value || 0) / top) * 100) : 0}%`, height: "100%", background: r.color || color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Column chart over time (days or weeks): one series, value on hover, first/last dates labelled.
// More than about two months of days is grouped into weeks, so every column stays visible.
export function Columns({ points: raw, valueKey, labelKey, color = T.mid, height = 120, format = fmtNum, labelFormat = (x) => x }) {
  if (!raw?.length) return <Empty>Nothing in this period.</Empty>;
  const weekly = raw.length > 62;
  const points = weekly
    ? Array.from({ length: Math.ceil(raw.length / 7) }, (_, i) => {
      const chunk = raw.slice(i * 7, i * 7 + 7);
      return { [labelKey]: chunk[0][labelKey], [valueKey]: chunk.reduce((n, p) => n + (p[valueKey] || 0), 0) };
    })
    : raw;
  const fmtLabel = weekly ? (x) => `week of ${labelFormat(x)}` : labelFormat;
  const max = Math.max(1, ...points.map((p) => p[valueKey] || 0));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, borderBottom: `1px solid ${T.border}` }}>
        {points.map((p) => (
          <div key={p[labelKey]} title={`${fmtLabel(p[labelKey])}: ${format(p[valueKey])}`} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end", cursor: "default" }}>
            <div style={{ width: "100%", height: `${((p[valueKey] || 0) / max) * 100}%`, minHeight: p[valueKey] ? 2 : 0, background: color, borderRadius: "4px 4px 0 0" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: T.faint }}>
        <span>{labelFormat(points[0][labelKey])}</span>
        <span>{weekly ? "Per week · " : ""}Highest: {format(max)}</span>
        <span>{labelFormat(raw[raw.length - 1][labelKey])}</span>
      </div>
    </div>
  );
}

export function LevelLegend() {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: T.muted }}>
      {LEVELS.map((l) => (
        <span key={l.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: l.fill }} aria-hidden /> {l.label} <span style={{ color: T.faint }}>{l.range}</span>
        </span>
      ))}
    </div>
  );
}

// One stacked bar across the four levels (2px gaps between segments), counts on hover.
export function LevelStack({ levels, height = 12, showCounts = false }) {
  const total = LEVELS.reduce((s, l) => s + (levels?.[l.key] || 0), 0);
  if (!total) return <div style={{ height, borderRadius: 4, background: T.track }} title="No learners assessed" />;
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height }} role="img" aria-label={LEVELS.map((l) => `${l.label} ${levels[l.key] || 0}`).join(", ")}>
        {LEVELS.filter((l) => levels[l.key]).map((l, i, arr) => (
          <div key={l.key} title={`${l.label}: ${levels[l.key]} (${Math.round((levels[l.key] / total) * 100)}%)`}
            style={{ flex: levels[l.key], background: l.fill, borderRadius: i === 0 && i === arr.length - 1 ? 4 : i === 0 ? "4px 0 0 4px" : i === arr.length - 1 ? "0 4px 4px 0" : 0 }} />
        ))}
      </div>
      {showCounts && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 5, fontSize: 11.5, color: T.muted }}>
          {LEVELS.map((l) => <span key={l.key}>{l.label}: <strong style={{ color: T.ink }}>{levels[l.key] || 0}</strong></span>)}
        </div>
      )}
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Weekday × hour, one hue light → dark (navy). Values on hover; a scale underneath.
export function Heatmap({ grid }) {
  const max = Math.max(1, ...grid.flat());
  const shade = (v) => (v === 0 ? T.track : `rgba(37, 71, 106, ${0.15 + 0.85 * (v / max)})`);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="an-table-wrap">
      <div style={{ minWidth: 560 }}>
        {order.map((d) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
            <span style={{ width: 34, fontSize: 11, color: T.muted, flexShrink: 0 }}>{DAYS[d]}</span>
            {grid[d].map((v, h) => (
              <div key={h} title={`${DAYS[d]} ${String(h).padStart(2, "0")}:00 — ${v} sign-in${v === 1 ? "" : "s"}`} style={{ flex: 1, height: 18, borderRadius: 3, background: shade(v) }} />
            ))}
          </div>
        ))}
        <div style={{ display: "flex", gap: 2, marginLeft: 36, fontSize: 10.5, color: T.faint }}>
          {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ flex: 1, textAlign: "center" }}>{h % 3 === 0 ? h : ""}</span>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: T.muted }}>
          <span>Fewer</span>
          {[0, 0.25, 0.5, 0.75, 1].map((x) => <span key={x} style={{ width: 16, height: 10, borderRadius: 2, background: x === 0 ? T.track : `rgba(37, 71, 106, ${0.15 + 0.85 * x})` }} />)}
          <span>More (busiest hour: {max})</span>
        </div>
      </div>
    </div>
  );
}

// Steps of a process with how many reached each: a bar per step, count and % of the first.
export function Funnel({ steps }) {
  const first = steps[0]?.count || 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((s) => (
        <div key={s.key} title={`${s.label}: ${fmtNum(s.count)}`}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ color: T.ink, fontWeight: 600 }}>{s.label}</span>
            <span style={{ color: T.ink, fontWeight: 800 }}>{fmtNum(s.count)} <span style={{ color: T.faint, fontWeight: 600 }}>{s.percent != null ? `· ${s.percent}%` : ""}</span></span>
          </div>
          <div style={{ height: 14, borderRadius: 4, background: T.track, overflow: "hidden" }}>
            <div style={{ width: `${first ? (s.count / first) * 100 : 0}%`, height: "100%", background: T.navy, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(","))];
  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CsvButton({ filename, columns, rows }) {
  return (
    <button type="button" onClick={() => downloadCsv(filename, columns, rows)} disabled={!rows?.length}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: "#fff", color: T.navy, fontSize: 12.5, fontWeight: 700, cursor: rows?.length ? "pointer" : "default", opacity: rows?.length ? 1 : 0.5 }}>
      <FiDownload size={13} /> CSV
    </button>
  );
}

/**
 * A sortable table. columns: [{ key, label, align: "num", render(row), csv(row), sort(row) }].
 * Shows `limit` rows with "Show all"; the CSV always has every row.
 */
export function DataTable({ columns, rows, filename, empty = "Nothing to show.", limit = 15, initialSort = null, title, subtitle, total }) {
  const [sort, setSort] = useState(initialSort);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sort) return rows || [];
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => (col?.sort ? col.sort(r) : r[sort.key]);
    return [...(rows || [])].sort((a, b) => {
      const x = val(a); const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort, columns]);
  const shown = all ? sorted : sorted.slice(0, limit);
  const toggle = (key) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <Card title={title} subtitle={subtitle} action={filename ? <CsvButton filename={filename} columns={columns} rows={sorted} /> : null}>
      {!rows?.length ? <Empty>{empty}</Empty> : (
        <>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={c.align === "num" ? "num" : undefined} onClick={() => toggle(c.key)} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {c.label}{sort?.key === c.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={r.id || r.key || r.learnerId || r.userId || i}>
                    {columns.map((c) => <td key={c.key} className={c.align === "num" ? "num" : undefined}>{c.render ? c.render(r) : r[c.key] ?? "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(sorted.length > limit || (total != null && total > sorted.length)) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, color: T.faint, flexWrap: "wrap" }}>
              <span>Showing {fmtNum(shown.length)} of {fmtNum(total ?? sorted.length)}{total != null && total > sorted.length ? ` (the first ${fmtNum(sorted.length)} are listed)` : ""}</span>
              {sorted.length > limit && <button type="button" className="an-link" onClick={() => setAll((x) => !x)}>{all ? "Show fewer" : "Show all"}</button>}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
