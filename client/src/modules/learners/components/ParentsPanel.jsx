import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiCopy, FiDownload, FiSearch } from "react-icons/fi";
import { useAllLearnersQuery, useLearnerLogins } from "../hooks/useLearners";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";

const lower = (v) => String(v || "").trim().toLowerCase();
const digits = (v) => String(v || "").replace(/\D/g, "");
const fmt = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

const LOGIN = {
  active: { label: "Active", bg: "#ECFDF5", color: "#047857" },
  inactive: { label: "Not used lately", bg: "#FFFBEB", color: "#B45309" },
  never: { label: "Never signed in", bg: "#FFFBEB", color: "#B45309" },
  deactivated: { label: "Switched off", bg: "#FEF2F2", color: "#B91C1C" },
  none: { label: "No login", bg: "#F3F4F6", color: "#6B7280" },
};

function Pill({ look }) {
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: look.bg, color: look.color, whiteSpace: "nowrap" }}>{look.label}</span>;
}

function downloadCsv(filename, header, rows) {
  const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const th = { padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #F3F4F6" };
const td = { padding: "11px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #F3F4F6", verticalAlign: "top" };

// Learners → Parents: every parent in the workspace, one row per family — taken from the learners'
// guardian details (grouped by email, else phone, else name) — with their children, the hubs those
// children are at, and the parent's own login (from the logins list, when this viewer can read it).
// Copy the emails, or download the list as a spreadsheet.
export default function ParentsPanel() {
  const { data: learnersData, isLoading } = useAllLearnersQuery();
  const { data: hubsData } = useAllLearningHubsQuery();
  const { data: logins } = useLearnerLogins();
  const [query, setQuery] = useState("");
  const [hubFilter, setHubFilter] = useState("");

  const hubName = useMemo(() => new Map((hubsData?.data || []).map((h) => [h.id, h.name])), [hubsData]);
  // The parent's own login: an email login with no username.
  const loginByEmail = useMemo(() => new Map((logins?.users || []).filter((u) => u.email && !u.username).map((u) => [lower(u.email), u])), [logins]);

  const families = useMemo(() => {
    const map = new Map();
    for (const l of learnersData?.data || []) {
      // An educator in training (TOT) learns for themself — they're not a family.
      if (l.teacherId) continue;
      const key = lower(l.guardianEmail) || digits(l.guardianPhone) || lower(l.guardianName);
      if (!key) continue;
      const f = map.get(key) || { key, name: "", email: "", phone: "", children: [], hubIds: new Set(), addedAt: null };
      f.name = f.name || l.guardianName || "";
      f.email = f.email || l.guardianEmail || "";
      f.phone = f.phone || l.guardianPhone || "";
      f.children.push({ id: l.id, name: `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Learner" });
      (l.hubIds || []).forEach((id) => f.hubIds.add(id));
      if (l.createdAt && (!f.addedAt || l.createdAt < f.addedAt)) f.addedAt = l.createdAt;
      map.set(key, f);
    }
    return [...map.values()].map((f) => {
      const login = f.email ? loginByEmail.get(lower(f.email)) : null;
      return {
        ...f,
        hubIds: [...f.hubIds],
        hubs: [...f.hubIds].map((id) => hubName.get(id)).filter(Boolean),
        login,
        loginStatus: login ? login.status : "none",
      };
    }).sort((a, b) => (a.name || "~").localeCompare(b.name || "~"));
  }, [learnersData, loginByEmail, hubName]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = families.filter((f) =>
    (!hubFilter || f.hubIds.includes(hubFilter))
    && (!words.length || words.every((w) => [f.name, f.email, f.phone, ...f.children.map((c) => c.name), ...f.hubs].join(" ").toLowerCase().includes(w))));
  const hubsInUse = [...new Set(families.flatMap((f) => f.hubIds))].map((id) => ({ id, name: hubName.get(id) })).filter((h) => h.name).sort((a, b) => a.name.localeCompare(b.name));
  const emails = [...new Set(shown.map((f) => lower(f.email)).filter(Boolean))];

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      toast.success(`${emails.length} parent email${emails.length === 1 ? "" : "s"} copied`);
    } catch {
      toast.error("Couldn't copy — your browser blocked it");
    }
  };
  const download = () => downloadCsv("parents.csv",
    ["Parent", "Email", "Phone", "Children", "Hubs", "Login", "Last signed in"],
    shown.map((f) => [f.name, f.email, f.phone, f.children.map((c) => c.name).join("; "), f.hubs.join("; "), (LOGIN[f.loginStatus] || LOGIN.none).label, fmt(f.login?.lastActiveAt)]));

  const btn = (enabled, primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
    border: primary ? "none" : "1.5px solid #D6E4EF", background: primary ? "#25476a" : "#fff", color: primary ? "#fff" : "#25476a",
    cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.5,
  });

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#111827" }}>Parents</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
            {isLoading ? "Loading…" : `${families.length} famil${families.length === 1 ? "y" : "ies"} — each parent's details, their children, and their login. Edit a parent's details from a child's page.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={copyEmails} disabled={!emails.length} style={btn(emails.length, false)}><FiCopy size={13} /> Copy emails{words.length || hubFilter ? ` (${emails.length})` : ""}</button>
          <button type="button" onClick={download} disabled={!shown.length} style={btn(shown.length, true)}><FiDownload size={13} /> Download (CSV)</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
          <FiSearch size={14} color="#9CA3AF" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parent, email, phone, child or hub" aria-label="Search parents" style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 32px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }} />
        </div>
        {hubsInUse.length > 1 && (
          <select value={hubFilter} onChange={(e) => setHubFilter(e.target.value)} aria-label="Hub" style={{ padding: "9px 10px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", background: "#fff" }}>
            <option value="">All hubs</option>
            {hubsInUse.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
      </div>

      {!isLoading && families.length === 0 ? (
        <p style={{ margin: 0, padding: "18px 0", fontSize: 13, color: "#9CA3AF" }}>No parent details yet. They come from each learner&apos;s guardian details.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #F3F4F6", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", minWidth: 820 }}>
            <thead><tr>
              <th style={th}>Parent</th><th style={th}>Contact</th><th style={th}>Children</th><th style={th}>Hubs</th><th style={th}>Login</th>
            </tr></thead>
            <tbody>
              {shown.map((f) => {
                const look = LOGIN[f.loginStatus] || LOGIN.none;
                return (
                  <tr key={f.key}>
                    <td style={td}><strong style={{ color: "#111827" }}>{f.name || "—"}</strong>{f.addedAt && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Since {fmt(f.addedAt)}</div>}</td>
                    <td style={td}>
                      {f.email ? <a href={`mailto:${f.email}`} style={{ color: "#2e7db5", textDecoration: "none" }}>{f.email}</a> : <span style={{ color: "#9CA3AF" }}>No email</span>}
                      <div style={{ marginTop: 2 }}>{f.phone ? <a href={`tel:${f.phone}`} style={{ color: "#374151", textDecoration: "none", fontSize: 12.5 }}>{f.phone}</a> : <span style={{ color: "#9CA3AF", fontSize: 12.5 }}>No phone</span>}</div>
                    </td>
                    <td style={td}>
                      {f.children.map((c, i) => (
                        <span key={c.id}>{i > 0 && ", "}<Link to={`/learners/${c.id}`} style={{ color: "#111827", fontWeight: 600, textDecoration: "none" }}>{c.name}</Link></span>
                      ))}
                    </td>
                    <td style={td}>{f.hubs.join(", ") || <span style={{ color: "#9CA3AF" }}>No hub yet</span>}</td>
                    <td style={td}>
                      <Pill look={look} />
                      {f.login?.lastActiveAt && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Last used {fmt(f.login.lastActiveAt)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p style={{ margin: 0, padding: 14, fontSize: 13, color: "#9CA3AF" }}>No parent matches.</p>}
        </div>
      )}
    </div>
  );
}
