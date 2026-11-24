import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import toast from "react-hot-toast";
import { FiDownload, FiMail, FiMessageCircle, FiPlus, FiUpload, FiUserPlus, FiX } from "react-icons/fi";
import { BRAND, FONT, card, cardHeading, pill } from "../../../theme/brand";
import { askConfirm } from "../../../components/ui/AskDialog";
import { affiliatesApi, errorOf, formatDay, PROGRAMMES } from "../services/affiliatesApi";
import PopUp from "./PopUp";

// My prospects (19 Nov 2026 — server affiliate.prospects.js): families the affiliate has talked to.
// While the claim is open (60 days by default), if the family signs up — even without the code —
// matched by the parent's phone or email, the affiliate earns. Add one family, or upload a list;
// invite them by WhatsApp (opens on the affiliate's phone) or email (sent by Digifunzi); let one go.

const btn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };
const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff", minWidth: 0 };
const label = { display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, minWidth: 0 };
const TONE = { open: "waiting", signed_up: "good", paying: "strong", lost: "neutral", expired: "neutral", released: "neutral", opted_out: "neutral", cancelled: "neutral" };
const FILTERS = [["open", "Waiting"], ["won", "Signed up"], ["closed", "Closed"], ["all", "All"]];
const blank = { parentName: "", phone: "", email: "", childName: "", childAge: "", programme: "", notes: "" };

// The spreadsheet columns we read (any order, case ignored).
const COLUMNS = { "parent name": "parentName", parent: "parentName", name: "parentName", phone: "phone", "phone number": "phone", email: "email", "child name": "childName", child: "childName", "child age": "childAge", age: "childAge", programme: "programme", program: "programme", notes: "notes" };
const programmeKey = (v) => {
  const t = String(v || "").trim().toLowerCase();
  if (!t) return null;
  return (PROGRAMMES.find(([k, l]) => k === t || l.toLowerCase() === t) || [])[0] || null;
};

function downloadTemplate() {
  const csv = "Parent name,Phone,Email,Child name,Child age,Programme,Notes\nMary Wanjiku,0712345678,mary@example.com,Amani,9,Home Learning,Met at the school open day\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "prospects-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function AddForm({ onDone, onCancel }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(blank);
  const [consent, setConsent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => affiliatesApi.addProspect({ ...form, consent }),
    onSuccess: (d) => { qc.setQueryData(["affiliates", "prospects"], d); toast.success(`${form.parentName.split(" ")[0]} is on your list`); setForm(blank); setConsent(false); onDone?.(); },
    onError: (err) => toast.error(errorOf(err, "Couldn't add the family")),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      <div className="mp-grid">
        <label style={label}>Parent's name<input style={input} value={form.parentName} onChange={set("parentName")} required maxLength={150} placeholder="e.g. Mary Wanjiku" /></label>
        <label style={label}>Phone<input style={input} value={form.phone} onChange={set("phone")} maxLength={40} placeholder="0712 345 678" inputMode="tel" /></label>
        <label style={label}>Email<input style={input} type="email" value={form.email} onChange={set("email")} maxLength={255} placeholder="mary@example.com" /></label>
        <label style={label}>Programme they're interested in
          <select style={input} value={form.programme} onChange={set("programme")}>
            <option value="">Not sure yet</option>
            {PROGRAMMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label style={label}>Child's name <span style={{ fontWeight: 500, color: BRAND.muted }}>(optional)</span><input style={input} value={form.childName} onChange={set("childName")} maxLength={150} /></label>
        <label style={label}>Child's age <span style={{ fontWeight: 500, color: BRAND.muted }}>(optional)</span><input style={input} type="number" min="2" max="25" value={form.childAge} onChange={set("childAge")} /></label>
      </div>
      <label style={label}>Notes for follow-up <span style={{ fontWeight: 500, color: BRAND.muted }}>(only you and our team see these)</span><textarea style={{ ...input, resize: "vertical" }} rows={3} value={form.notes} onChange={set("notes")} maxLength={1000} placeholder="e.g. Met at the school open day — wants weekend classes; call back after 5 Dec" /></label>
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>We need the phone number or email — that&rsquo;s how we recognise the family when they sign up.</p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: BRAND.inkSoft, cursor: "pointer", lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: BRAND.skyTint, border: `1px solid ${BRAND.skyBorder}` }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
        <span>This family agreed that I share their details with Digifunzi and that Digifunzi can contact them.</span>
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" style={{ ...btn, padding: "10px 16px" }} onClick={onCancel}>Cancel</button>
        <button type="submit" style={{ ...primary, padding: "10px 16px", opacity: consent ? 1 : 0.6 }} disabled={save.isPending || !consent}><FiUserPlus size={14} /> {save.isPending ? "Adding…" : "Add to my list"}</button>
      </div>
    </form>
  );
}

function UploadForm({ onDone, onCancel }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState(null);
  const read = (file) => {
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (out) => {
        const parsed = out.data.map((r) => {
          const row = {};
          for (const [k, v] of Object.entries(r)) {
            const key = COLUMNS[String(k).trim().toLowerCase()];
            if (key) row[key] = typeof v === "string" ? v.trim() : v;
          }
          row.programme = programmeKey(row.programme);
          return row;
        }).filter((r) => r.parentName || r.phone || r.email);
        setRows(parsed);
        if (!parsed.length) toast.error("No families found — check the columns match the template");
      },
      error: () => toast.error("That file couldn't be read — save it as CSV"),
    });
  };
  const upload = useMutation({
    mutationFn: () => affiliatesApi.addProspects(rows),
    onSuccess: (d) => {
      const { results: res, ...list } = d;
      qc.setQueryData(["affiliates", "prospects"], list);
      setResults(res);
      const added = res.filter((r) => r.ok).length;
      toast.success(`${added} of ${res.length} added`);
      if (added === res.length) onDone?.();
    },
    onError: (err) => toast.error(errorOf(err, "Couldn't upload the list")),
  });
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      <p style={{ margin: 0, fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.5 }}>
        Upload a CSV with a row per family: <strong>Parent name, Phone, Email, Child name, Child age, Programme, Notes</strong>. Up to 200 at a time.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={btn} onClick={downloadTemplate}><FiDownload size={14} /> Download the template</button>
        <button type="button" style={btn} onClick={() => fileRef.current?.click()}><FiUpload size={14} /> Choose a file</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
        {fileName && <span style={{ fontSize: 13, color: BRAND.muted }}>{fileName}{rows ? ` — ${rows.length} ${rows.length === 1 ? "family" : "families"}` : ""}</span>}
      </div>
      {rows?.length > 0 && (
        <>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: BRAND.inkSoft, cursor: "pointer", lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: BRAND.skyTint, border: `1px solid ${BRAND.skyBorder}` }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
            <span>Every family on this list agreed that I share their details with Digifunzi and that Digifunzi can contact them.</span>
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" style={{ ...btn, padding: "10px 16px" }} onClick={onCancel}>Cancel</button>
            <button type="button" style={{ ...primary, padding: "10px 16px", opacity: consent ? 1 : 0.6 }} disabled={!consent || upload.isPending} onClick={() => upload.mutate()}><FiUpload size={14} /> {upload.isPending ? "Adding…" : `Add ${rows.length} ${rows.length === 1 ? "family" : "families"}`}</button>
          </div>
        </>
      )}
      {results && results.some((r) => !r.ok) && (
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: 13, color: BRAND.ink }}>Not added:</strong>
          {results.filter((r) => !r.ok).map((r) => <span key={r.row} style={{ fontSize: 12.5, color: BRAND.goldText }}>Row {r.row}{r.name ? ` (${r.name})` : ""}: {r.error}</span>)}
        </div>
      )}
    </div>
  );
}

export default function MyProspects() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["affiliates", "prospects"], queryFn: affiliatesApi.myProspects });
  const [panel, setPanel] = useState(null); // null | "add" | "upload"
  const [filter, setFilter] = useState("open");
  const invite = useMutation({
    mutationFn: ({ id, channel }) => affiliatesApi.inviteProspect(id, channel),
    onSuccess: (d) => {
      if (d.channel === "whatsapp" && d.waUrl) window.open(d.waUrl, "_blank", "noopener");
      else toast.success("Invite emailed");
      qc.invalidateQueries({ queryKey: ["affiliates", "prospects"] });
    },
    onError: (err) => toast.error(errorOf(err)),
  });
  const release = useMutation({
    mutationFn: (id) => affiliatesApi.releaseProspect(id),
    onSuccess: (d) => { qc.setQueryData(["affiliates", "prospects"], d); toast.success("Released"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  if (!data || !data.settings?.enabled) return null;
  const list = data.prospects;
  const won = (p) => p.state.key === "signed_up" || p.state.key === "paying";
  const shown = list.filter((p) => (filter === "all" ? true : filter === "open" ? p.state.key === "open" : filter === "won" ? won(p) : !won(p) && p.state.key !== "open"));
  const count = (f) => list.filter((p) => (f === "open" ? p.state.key === "open" : f === "won" ? won(p) : !won(p) && p.state.key !== "open")).length;

  return (
    <section style={{ ...card, padding: 18, display: "grid", gap: 14, fontFamily: FONT }}>
      <style>{`.mp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; } @media (max-width: 640px) { .mp-grid { grid-template-columns: 100%; } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <h2 style={cardHeading}><FiUserPlus size={13} /> My prospects</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.55 }}>
            Families you&rsquo;ve talked to. If they sign up within <strong>{data.settings.claimDays} days</strong> — even without your code — you earn.
            {data.settings.claimOrder === "code_first" ? " If they type someone else's code, that code counts." : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={primary} onClick={() => setPanel("add")}><FiPlus size={14} /> Add a family</button>
          <button type="button" style={btn} onClick={() => setPanel("upload")}><FiUpload size={14} /> Upload a list</button>
        </div>
      </div>
      {panel === "add" && (
        <PopUp title="Add a family" subtitle={`If they sign up within ${data.settings.claimDays} days — even without your code — you earn.`} onClose={() => setPanel(null)}>
          <AddForm onDone={() => setPanel(null)} onCancel={() => setPanel(null)} />
        </PopUp>
      )}
      {panel === "upload" && (
        <PopUp title="Upload a list of families" subtitle="Add up to 200 families at once from a spreadsheet." onClose={() => setPanel(null)}>
          <UploadForm onDone={() => setPanel(null)} onCancel={() => setPanel(null)} />
        </PopUp>
      )}

      {list.length > 0 && (
        <div role="group" aria-label="Show" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} style={{ ...btn, padding: "6px 12px", background: filter === k ? BRAND.navy : "#fff", color: filter === k ? "#fff" : BRAND.inkSoft, borderColor: filter === k ? BRAND.navy : BRAND.border }}>
              {l}{k !== "all" && count(k) ? ` · ${count(k)}` : ""}
            </button>
          ))}
        </div>
      )}

      {!list.length ? (
        <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>No families yet. Add the families you&rsquo;ve talked to — you earn if they sign up, code or no code.</p>
      ) : !shown.length ? (
        <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>Nothing here.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {shown.map((p) => {
            const open = p.state.key === "open";
            return (
              <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "11px 13px", borderRadius: 12, border: `1px solid ${BRAND.line}`, background: open ? "#fff" : BRAND.canvas }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <strong style={{ color: BRAND.ink, fontSize: 14 }}>{p.parentName}</strong>
                  <div style={{ fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5 }}>
                    {[p.phone, p.email].filter(Boolean).join(" · ")}
                    {p.childName ? ` · ${p.childName}${p.childAge ? ` (${p.childAge})` : ""}` : ""}
                    {p.programmeLabel ? ` · ${p.programmeLabel}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: BRAND.faint }}>
                    Added {formatDay(p.createdAt)}
                    {p.invitedAt ? ` · invited ${formatDay(p.invitedAt)}${p.inviteCount > 1 ? ` (${p.inviteCount}×)` : ""}` : ""}
                    {p.signedUpFor ? ` · signed up for ${p.signedUpFor}` : ""}
                  </div>
                  {open && p.notes && <div style={{ fontSize: 12.5, color: BRAND.inkSoft, marginTop: 2 }}>{p.notes}</div>}
                </div>
                <span style={pill(TONE[p.state.key] || "neutral")}>{p.state.label}{open ? ` · ${p.state.daysLeft} ${p.state.daysLeft === 1 ? "day" : "days"} left` : ""}</span>
                {open && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {data.canInvite && p.phone && <button type="button" style={btn} disabled={invite.isPending} onClick={() => invite.mutate({ id: p.id, channel: "whatsapp" })}><FiMessageCircle size={14} /> WhatsApp</button>}
                    {data.canInvite && p.email && <button type="button" style={btn} disabled={invite.isPending} onClick={() => invite.mutate({ id: p.id, channel: "email" })}><FiMail size={14} /> Email</button>}
                    <button type="button" style={{ ...btn, padding: "8px 10px" }} aria-label={`Let ${p.parentName} go`} title="Let this family go"
                      onClick={async () => { if (await askConfirm({ title: `Let ${p.parentName} go?`, message: "They come off your list and their details are removed. If they sign up later, it won't be credited to you.", confirmLabel: "Let them go", tone: "danger" })) release.mutate(p.id); }}>
                      <FiX size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
