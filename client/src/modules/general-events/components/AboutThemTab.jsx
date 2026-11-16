import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiDownload, FiMessageSquare, FiUsers, FiX } from "react-icons/fi";
import { BRAND, card, cardHeading, pill } from "../../../theme/brand";
import { PeopleTable, cellStyle } from "../../../components/ui/PeopleViews";
import { useEventRegistrations } from "../hooks/useGeneralEvents";
import { REG_STATUS, SOURCE_LABEL, btn, hintStyle, inputStyle, shortDate } from "../shared";

// An event's "About them" tab (16 Nov 2026): what the people registering told us — who they are
// (and their school), their children's ages, what they're interested in, how they heard of us, where
// they found the event and whether they're happy to hear from us — one row each, sortable, filtered
// by any answer, downloadable as shown. The filters live in the address (?who=&interest=&heard=&age=
// &where=&status=&answered=1), so the Overview's bars open it already filtered.

// The age bands the Overview counts in (general-event.service.js's AGE_BANDS).
export const AGE_BANDS = [[3, 5], [6, 8], [9, 11], [12, 14], [15, 18]];
const bandKey = ([lo, hi]) => `${lo}-${hi}`;

// Where they found the event, worded as the Overview's "Where they found it" (statsFor on the server).
export function foundVia(r) {
  const v = r.visitSource;
  if (!v) return r.source?.startsWith("system") ? "In the system" : r.source === "walk_in" ? "Walked in" : r.source === "staff" ? "Added by staff" : "Direct";
  if (v.utmSource) return v.utmSource;
  if (v.referrer) { try { return new URL(v.referrer).hostname.replace(/^www\./, ""); } catch { return "Other site"; } }
  return "Direct";
}

const answered = (r) => Boolean(r.detailsAt || r.personType || (r.childrenAges || []).length || (r.interests || []).length || r.heardFrom);

const STATUS_FILTERS = {
  live: ["Coming or waiting", (r) => r.status !== "cancelled"],
  registered: ["Registered", (r) => r.status === "registered"],
  waitlisted: ["Waiting list", (r) => r.status === "waitlisted"],
  arrived: ["Arrived", (r) => !!r.attendedAt],
  all: ["Everyone, cancelled too", () => true],
};

function toCsv(rows, q) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Name", "Email", "Phone", "Status", "People", "Who they are", "Organisation", "Children's ages", "Interested in", "Heard about us", "Found it via", "Happy to hear from us", "Registered", "Told us about themselves"];
  const lines = rows.map((r) => [
    r.name, r.email, r.phone, REG_STATUS[r.status]?.label || r.status, r.partySize,
    q.personTypes[r.personType] || "", r.organisation || "", (r.childrenAges || []).join(" "),
    (r.interests || []).map((k) => q.interests[k] || k).join("; "), q.heardFrom[r.heardFrom] || "", foundVia(r),
    r.marketingConsent ? "Yes" : "No", shortDate(r.createdAt), r.detailsAt ? shortDate(r.detailsAt) : "",
  ].map(cell).join(","));
  return [head.map(cell).join(","), ...lines].join("\r\n");
}

function download(name, text) {
  const blob = new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function AboutThemTab({ event }) {
  const { data: regs = [], isLoading } = useEventRegistrations(event.id);
  const [params, setParams] = useSearchParams();
  const q = event.public.questions;
  const f = {
    who: params.get("who") || "",
    interest: params.get("interest") || "",
    heard: params.get("heard") || "",
    age: params.get("age") || "",
    where: params.get("where") || "",
    status: STATUS_FILTERS[params.get("status")] ? params.get("status") : "live",
    answered: params.get("answered") === "1",
  };
  const set = (key, value) => setParams((p) => {
    const next = new URLSearchParams(p);
    next.set("tab", "about");
    if (value && value !== "live") next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const clear = () => setParams({ tab: "about" }, { replace: true });
  const filtering = f.who || f.interest || f.heard || f.age || f.where || f.answered || f.status !== "live";

  const inStatus = useMemo(() => regs.filter(STATUS_FILTERS[f.status][1]), [regs, f.status]);
  const shown = useMemo(() => inStatus.filter((r) => {
    if (f.answered && !answered(r)) return false;
    if (f.who && r.personType !== f.who) return false;
    if (f.interest && !(r.interests || []).includes(f.interest)) return false;
    if (f.heard && r.heardFrom !== f.heard) return false;
    if (f.where && foundVia(r) !== f.where) return false;
    if (f.age) {
      const [lo, hi] = f.age.split("-").map(Number);
      if (!(r.childrenAges || []).some((a) => a >= lo && a <= hi)) return false;
    }
    return true;
  }), [inStatus, f.answered, f.who, f.interest, f.heard, f.where, f.age]);

  const told = inStatus.filter(answered).length;
  const consent = inStatus.filter((r) => r.marketingConsent).length;
  const places = [...new Set(regs.map(foundVia))].sort();

  const columns = [
    { key: "name", label: "Name", sortValue: (r) => r.name.toLowerCase() },
    { key: "who", label: "Who they are", sortValue: (r) => q.personTypes[r.personType] || null },
    { key: "ages", label: "Children's ages", sortValue: (r) => ((r.childrenAges || []).length ? Math.min(...r.childrenAges) : null) },
    { key: "interests", label: "Interested in", sortValue: (r) => ((r.interests || []).length ? (r.interests || []).length : null) },
    { key: "heard", label: "Heard about us", sortValue: (r) => q.heardFrom[r.heardFrom] || null },
    { key: "where", label: "Found it via", sortValue: (r) => foundVia(r) },
    { key: "consent", label: "Happy to hear from us", sortValue: (r) => (r.marketingConsent ? 1 : 0) },
    { key: "registered", label: "Registered", sortValue: (r) => new Date(r.createdAt).getTime() },
  ];
  const dash = <span style={{ color: BRAND.faint }}>—</span>;

  const select = (label, key, options) => (
    <label style={{ display: "grid", gap: 4, fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 0 }}>
      {label}
      <select style={{ ...inputStyle, textTransform: "none", letterSpacing: 0, fontWeight: 500 }} value={f[key]} onChange={(e) => set(key, e.target.value)}>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );

  return (
    <div className="ge-page">
      <div className="ge-kpis">
        <Tile label="Registered" value={inStatus.length} note={STATUS_FILTERS[f.status][0]} />
        <Tile label="Told us about themselves" value={told} note={inStatus.length ? `${Math.round((told / inStatus.length) * 100)}% answered the “about you” step` : "Nobody yet"} />
        <Tile label="Happy to hear from us" value={consent} note="Ticked “keep me posted”" />
        <Tile label="Shown below" value={shown.length} note={filtering ? "With these filters" : "Everyone in the list"} />
      </div>

      <section style={{ ...card, padding: 16, display: "grid", gap: 12 }}>
        <div className="ge-row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ ...cardHeading, margin: 0 }}><FiUsers size={13} /> Filter by what they told us</h3>
          <div className="ge-row">
            {filtering && <button type="button" style={btn()} onClick={clear}><FiX size={14} /> Clear filters</button>}
            <button type="button" style={btn()} disabled={!shown.length} onClick={() => download(`${event.slug}-about-them.csv`, toCsv(shown, q))}><FiDownload size={14} /> Spreadsheet of these</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {select("Who they are", "who", [["", "Anyone"], ...Object.entries(q.personTypes)])}
          {select("Interested in", "interest", [["", "Anything"], ...Object.entries(q.interests)])}
          {select("Heard about us", "heard", [["", "Anywhere"], ...Object.entries(q.heardFrom)])}
          {select("Children's ages", "age", [["", "Any age"], ...AGE_BANDS.map((b) => [bandKey(b), `${b[0]}–${b[1]}`])])}
          {select("Found it via", "where", [["", "Anywhere"], ...places.map((p) => [p, p])])}
          {select("Registrations", "status", Object.entries(STATUS_FILTERS).map(([k, [label]]) => [k, label]))}
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: BRAND.inkSoft, cursor: "pointer" }}>
          <input type="checkbox" checked={f.answered} onChange={(e) => set("answered", e.target.checked ? "1" : "")} />
          Only those who told us about themselves
        </label>
      </section>

      {isLoading ? <p style={hintStyle}>Loading…</p> : shown.length === 0 ? (
        <p style={{ ...hintStyle, margin: 0 }}>{regs.length ? "No one matches these filters." : "No one has registered yet."}</p>
      ) : (
        <PeopleTable
          columns={columns}
          rows={shown}
          initialSort={{ key: "registered", dir: "desc" }}
          renderRow={(r) => (
            <tr key={r.id} style={{ opacity: r.status === "cancelled" ? 0.6 : 1 }}>
              <td style={{ ...cellStyle, minWidth: 190 }}>
                <div style={{ fontWeight: 700, color: BRAND.ink, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {r.name}
                  {r.status !== "registered" && <span style={pill(REG_STATUS[r.status]?.tone || "neutral")}>{REG_STATUS[r.status]?.label || r.status}</span>}
                  {r.leadId && <Link to={`/enquiries?lead=${r.leadId}`} title="Their enquiry" style={{ color: BRAND.mid, display: "inline-flex" }}><FiMessageSquare size={13} /></Link>}
                </div>
                <div style={{ fontSize: 12, color: BRAND.muted, overflowWrap: "anywhere" }}>{r.email} · {r.phone}</div>
                <div style={{ fontSize: 11.5, color: BRAND.faint }}>{SOURCE_LABEL[r.source] || r.source}{r.partySize > 1 ? ` · ${r.partySize} people` : ""}</div>
              </td>
              <td style={cellStyle}>{r.personType ? <>{q.personTypes[r.personType]}{r.organisation ? <div style={{ fontSize: 12, color: BRAND.muted }}>{r.organisation}</div> : null}</> : dash}</td>
              <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{(r.childrenAges || []).length ? [...r.childrenAges].sort((a, b) => a - b).join(", ") : dash}</td>
              <td style={{ ...cellStyle, minWidth: 180 }}>
                {(r.interests || []).length ? (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{r.interests.map((k) => <span key={k} style={pill("good")}>{q.interests[k] || k}</span>)}</div>
                ) : dash}
              </td>
              <td style={cellStyle}>{r.heardFrom ? q.heardFrom[r.heardFrom] : dash}</td>
              <td style={cellStyle}>{foundVia(r)}</td>
              <td style={cellStyle}>{r.marketingConsent ? <span style={pill("good")}>Yes</span> : <span style={{ color: BRAND.faint }}>No</span>}</td>
              <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{shortDate(r.createdAt)}</td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

function Tile({ label, value, note }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.ink, lineHeight: 1.2 }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{note}</div>}
    </div>
  );
}
