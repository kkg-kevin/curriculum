import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiCopy, FiDownload, FiSearch, FiUsers } from "react-icons/fi";
import { useBootcampParticipantsQuery, useBootcampRunsQuery } from "../hooks/useBootcamps";
import { Segmented } from "../../checkins/shared";

const SOURCE = {
  website: { label: "Website sign-up", bg: "#EFF6FF", color: "#1D4ED8" },
  staff:   { label: "Added by staff", bg: "#F3F4F6", color: "#374151" },
  enquiry: { label: "Didn't finish signing up", bg: "#FFFBEB", color: "#B45309" },
};
const fmt = (s) => (s ? new Date(String(s).length === 10 ? `${s}T00:00:00` : s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
const runLabel = (p) => (p.runStartDate ? `${fmt(p.runStartDate)} – ${fmt(p.runEndDate)}` : p.runName || "—");

function Pill({ look, children }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: look.bg, color: look.color, whiteSpace: "nowrap" }}>{children ?? look.label}</span>;
}

// One family per parent: by email, else phone, else name — with their children and the runs they came to.
function familiesOf(participants) {
  const map = new Map();
  for (const p of participants) {
    const id = (p.parentEmail || "").toLowerCase() || (p.parentPhone || "").replace(/\D/g, "") || (p.parentName || "").toLowerCase() || p.key;
    const family = map.get(id) || { key: id, parentName: p.parentName, parentEmail: p.parentEmail, parentPhone: p.parentPhone, children: new Set(), runs: new Set(), lastJoined: null };
    family.parentName = family.parentName || p.parentName;
    family.parentEmail = family.parentEmail || p.parentEmail;
    family.parentPhone = family.parentPhone || p.parentPhone;
    if (p.learnerName && p.learnerName !== "—") family.children.add(p.learnerName);
    family.runs.add(runLabel(p));
    if (!family.lastJoined || (p.joinedAt && p.joinedAt > family.lastJoined)) family.lastJoined = p.joinedAt;
    map.set(id, family);
  }
  return [...map.values()].map((f) => ({ ...f, children: [...f.children], runs: [...f.runs] }))
    .sort((a, b) => String(a.parentName || "").localeCompare(String(b.parentName || "")));
}

function downloadCsv(filename, header, rows) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const th = { padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #F3F4F6" };
const td = { padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #F3F4F6", verticalAlign: "top" };

// The learners and parents who took part in this bootcamp — this run, or every run of it — with
// their contact details, to reach out when it runs again. Learners: one row per child per run.
// Parents: one row per family, with their children and the runs they came to. Copy the parents'
// emails, or download either list as a spreadsheet (CSV).
export default function BootcampParticipants({ bootcamp }) {
  const { data: runs = [] } = useBootcampRunsQuery(bootcamp.id);
  const hasRuns = runs.length > 1;
  const [scope, setScope] = useState("run");
  const [view, setView] = useState("learners");
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, error } = useBootcampParticipantsQuery(bootcamp.id, hasRuns ? scope : "run");
  const series = hasRuns && scope === "series";

  const participants = useMemo(() => data?.participants || [], [data]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text) => words.every((w) => text.toLowerCase().includes(w));
  const learners = participants.filter((p) => !words.length || matches([p.learnerName, p.parentName, p.parentEmail, p.parentPhone, p.hubName, p.cohort].filter(Boolean).join(" ")));
  const families = familiesOf(participants).filter((f) => !words.length || matches([f.parentName, f.parentEmail, f.parentPhone, ...f.children].filter(Boolean).join(" ")));
  const emails = [...new Set(participants.map((p) => p.parentEmail).filter(Boolean).map((e) => e.toLowerCase()))];

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      toast.success(`${emails.length} parent email${emails.length === 1 ? "" : "s"} copied`);
    } catch {
      toast.error("Couldn't copy — your browser blocked it");
    }
  };
  const fileBase = `${bootcamp.name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-")}${series ? "-all-runs" : ""}`;
  const download = () => {
    if (view === "learners") {
      downloadCsv(`${fileBase}-learners.csv`,
        ["Learner", "Age", "Gender", "Username", "Hub", "Cohort", "Parent", "Parent email", "Parent phone", "Run", "How they joined", "Paid", "Joined"],
        learners.map((p) => [p.learnerName, p.age ?? "", p.gender || "", p.username || "", p.hubName || "", p.cohort || "", p.parentName || "", p.parentEmail || "", p.parentPhone || "", runLabel(p), SOURCE[p.source]?.label || "", p.paid === true ? "Yes" : p.paid === false ? "No" : "", fmt(p.joinedAt)]));
    } else {
      downloadCsv(`${fileBase}-parents.csv`,
        ["Parent", "Email", "Phone", "Children", "Runs", "Last joined"],
        families.map((f) => [f.parentName || "", f.parentEmail || "", f.parentPhone || "", f.children.join("; "), f.runs.join("; "), fmt(f.lastJoined)]));
    }
  };

  const familyCount = familiesOf(participants).length;

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 6 }}><FiUsers size={13} /> Learners &amp; parents</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
            {isLoading ? "Loading…" : `${participants.length} learner${participants.length === 1 ? "" : "s"} from ${familyCount} famil${familyCount === 1 ? "y" : "ies"}${series ? ` across ${data?.runs?.length || runs.length} runs` : ""} — reach out to them when it runs again.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={copyEmails} disabled={!emails.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #D6E4EF", background: "#fff", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: emails.length ? "pointer" : "not-allowed", opacity: emails.length ? 1 : 0.5 }}>
            <FiCopy size={13} /> Copy parent emails
          </button>
          <button type="button" onClick={download} disabled={!participants.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#25476a", color: "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: participants.length ? "pointer" : "not-allowed", opacity: participants.length ? 1 : 0.5 }}>
            <FiDownload size={13} /> Download {view === "learners" ? "learners" : "parents"} (CSV)
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Segmented label="Show" options={[{ key: "learners", label: "Learners", count: participants.length }, { key: "parents", label: "Parents", count: familyCount }]} value={view} onChange={setView} />
          {hasRuns && <Segmented label="Runs" options={[{ key: "run", label: "This run" }, { key: "series", label: `All ${runs.length} runs` }]} value={scope} onChange={setScope} />}
        </div>
        {participants.length > 5 && (
          <div style={{ position: "relative", flex: "0 1 300px" }}>
            <FiSearch size={14} color="#9CA3AF" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone, hub" aria-label="Search learners and parents" style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 32px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }} />
          </div>
        )}
      </div>

      {isError && <p style={{ margin: 0, fontSize: 13, color: "#B91C1C" }}>{error?.message || "Couldn't load the learners."}</p>}
      {!isLoading && !isError && participants.length === 0 && (
        <p style={{ margin: 0, padding: "16px 0", fontSize: 13, color: "#9CA3AF" }}>No learners yet. Website sign-ups and learners added to this bootcamp&apos;s classes show here.</p>
      )}

      {participants.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #F3F4F6", borderRadius: 12 }}>
          {view === "learners" ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 860 }}>
              <thead><tr>
                <th style={th}>Learner</th><th style={th}>Hub · cohort</th><th style={th}>Parent</th><th style={th}>Contact</th>
                {series && <th style={th}>Run</th>}<th style={th}>Joined</th>
              </tr></thead>
              <tbody>
                {learners.map((p) => (
                  <tr key={p.key}>
                    <td style={td}>
                      {p.learnerId ? <Link to={`/learners/${p.learnerId}`} style={{ fontWeight: 700, color: "#111827", textDecoration: "none" }}>{p.learnerName}</Link> : <strong style={{ color: "#111827" }}>{p.learnerName}</strong>}
                      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{[p.age != null ? `${p.age} yrs` : null, p.gender, p.username ? `@${p.username}` : null].filter(Boolean).join(" · ") || "—"}</div>
                    </td>
                    <td style={td}>{p.hubName || "—"}{p.cohort && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{p.cohort}</div>}</td>
                    <td style={td}>{p.parentName || "—"}</td>
                    <td style={td}>
                      {p.parentEmail ? <a href={`mailto:${p.parentEmail}`} style={{ color: "#2e7db5", textDecoration: "none" }}>{p.parentEmail}</a> : <span style={{ color: "#9CA3AF" }}>No email</span>}
                      <div style={{ marginTop: 2 }}>{p.parentPhone ? <a href={`tel:${p.parentPhone}`} style={{ color: "#374151", textDecoration: "none", fontSize: 12.5 }}>{p.parentPhone}</a> : <span style={{ color: "#9CA3AF", fontSize: 12.5 }}>No phone</span>}</div>
                    </td>
                    {series && <td style={{ ...td, whiteSpace: "nowrap" }}>{runLabel(p)}</td>}
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Pill look={SOURCE[p.source] || SOURCE.staff} />
                        {p.paid === true && <Pill look={{ bg: "#ECFDF5", color: "#047857" }}>Paid</Pill>}
                        {p.paid === false && <Pill look={{ bg: "#FEF2F2", color: "#B91C1C" }}>Not paid</Pill>}
                      </div>
                      {p.joinedAt && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>{fmt(p.joinedAt)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 760 }}>
              <thead><tr>
                <th style={th}>Parent</th><th style={th}>Contact</th><th style={th}>Children</th><th style={th}>{series ? "Runs attended" : "Run"}</th>
              </tr></thead>
              <tbody>
                {families.map((f) => (
                  <tr key={f.key}>
                    <td style={td}><strong style={{ color: "#111827" }}>{f.parentName || "—"}</strong></td>
                    <td style={td}>
                      {f.parentEmail ? <a href={`mailto:${f.parentEmail}`} style={{ color: "#2e7db5", textDecoration: "none" }}>{f.parentEmail}</a> : <span style={{ color: "#9CA3AF" }}>No email</span>}
                      <div style={{ marginTop: 2 }}>{f.parentPhone ? <a href={`tel:${f.parentPhone}`} style={{ color: "#374151", textDecoration: "none", fontSize: 12.5 }}>{f.parentPhone}</a> : <span style={{ color: "#9CA3AF", fontSize: 12.5 }}>No phone</span>}</div>
                    </td>
                    <td style={td}>{f.children.join(", ") || "—"}</td>
                    <td style={td}>{f.runs.map((r) => <div key={r} style={{ whiteSpace: "nowrap" }}>{r}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {((view === "learners" && learners.length === 0) || (view === "parents" && families.length === 0)) && words.length > 0 && (
            <p style={{ margin: 0, padding: 14, fontSize: 13, color: "#9CA3AF" }}>Nothing matches “{query.trim()}”.</p>
          )}
        </div>
      )}
    </div>
  );
}
