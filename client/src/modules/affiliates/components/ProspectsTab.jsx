import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertCircle, FiCheck, FiPlus, FiRepeat, FiX } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import { askConfirm } from "../../../components/ui/AskDialog";
import { HistoryButton } from "../../activity/components/RecordStamp";
import { affiliatesApi, errorOf, formatDay, PROGRAMMES } from "../services/affiliatesApi";
import PopUp from "./PopUp";
import { followUpTone } from "../pages/ProspectPage";

// Affiliates → Prospects (19 Nov 2026 — server affiliate.prospects.js): every family an affiliate
// has registered. Staff see who registered whom and the contact details, decide possible matches
// (a sign-up with the same parent name but a different phone / email), move a claim to another
// affiliate, let one go, or register a family for an affiliate.

const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };
const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff", minWidth: 0 };
const label = { display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, minWidth: 0 };
const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BRAND.border}`, whiteSpace: "nowrap" };
const td = { padding: "11px 12px", fontSize: 13, color: BRAND.inkSoft, borderBottom: `1px solid ${BRAND.line}`, verticalAlign: "top" };
const TONE = { open: "waiting", signed_up: "good", paying: "strong", lost: "neutral", expired: "neutral", released: "neutral", opted_out: "neutral", cancelled: "neutral" };
const FILTERS = [["open", "Open"], ["matches", "Possible matches"], ["signed_up", "Signed up"], ["closed", "Closed"], ["", "All"]];
const blank = { affiliateId: "", parentName: "", phone: "", email: "", childName: "", childAge: "", programme: "", notes: "" };

function AddForAffiliate({ affiliates, onDone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(blank);
  const [consent, setConsent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => affiliatesApi.addProspectFor({ ...form, consent }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["affiliates", "prospects-admin"] }); toast.success("Family registered"); onDone(); },
    onError: (err) => toast.error(errorOf(err)),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
        <label style={label}>For affiliate
          <select style={input} value={form.affiliateId} onChange={set("affiliateId")} required>
            <option value="">Choose…</option>
            {affiliates.filter((a) => a.status === "active").map((a) => <option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}
          </select>
        </label>
        <label style={label}>Parent's name<input style={input} value={form.parentName} onChange={set("parentName")} required maxLength={150} /></label>
        <label style={label}>Phone<input style={input} value={form.phone} onChange={set("phone")} maxLength={40} /></label>
        <label style={label}>Email<input style={input} type="email" value={form.email} onChange={set("email")} maxLength={255} /></label>
        <label style={label}>Programme
          <select style={input} value={form.programme} onChange={set("programme")}>
            <option value="">Not sure yet</option>
            {PROGRAMMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label style={label}>Child (optional)<input style={input} value={form.childName} onChange={set("childName")} maxLength={150} /></label>
        <label style={label}>Child's age (optional)<input style={input} type="number" min="2" max="25" value={form.childAge} onChange={set("childAge")} /></label>
      </div>
      <label style={label}>Notes for follow-up <span style={{ fontWeight: 500, color: BRAND.muted }}>(what was said, what they want, when to call back)</span><textarea style={{ ...input, resize: "vertical" }} rows={3} value={form.notes} onChange={set("notes")} maxLength={1000} placeholder="e.g. Met at the open day — wants weekend classes for two children; call back after 5 Dec." /></label>
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>A phone number or email is needed — that&rsquo;s how the family is recognised when they sign up.</p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: BRAND.inkSoft, cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: BRAND.skyTint, border: `1px solid ${BRAND.skyBorder}`, lineHeight: 1.5 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
        <span>The family agreed to share their details with Digifunzi and to be contacted.</span>
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" style={{ ...btn, padding: "10px 16px", fontSize: 13.5 }} onClick={onDone}>Cancel</button>
        <button type="submit" style={{ ...primary, padding: "10px 16px", fontSize: 13.5, opacity: consent ? 1 : 0.6 }} disabled={!consent || save.isPending}>{save.isPending ? "Saving…" : "Register the family"}</button>
      </div>
    </form>
  );
}

export default function ProspectsTab({ affiliates = [] }) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") ?? "open";
  const setFilter = (f) => setParams((p) => { const n = new URLSearchParams(p); n.set("tab", "prospects"); if (f) n.set("filter", f); else n.set("filter", ""); return n; }, { replace: true });
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(null); // prospect id
  const navigate = useNavigate();
  const openProspect = (p) => navigate(`/affiliates/prospects/${p.id}`);
  const { data, isLoading } = useQuery({ queryKey: ["affiliates", "prospects-admin", filter], queryFn: () => affiliatesApi.prospects(filter ? { filter } : {}) });
  const done = (msg) => () => { qc.invalidateQueries({ queryKey: ["affiliates", "prospects-admin"] }); qc.invalidateQueries({ queryKey: ["affiliates", "referrals"] }); toast.success(msg); };
  const fail = (err) => toast.error(errorOf(err));
  const decide = useMutation({ mutationFn: ({ id, approve }) => affiliatesApi.decideMatch(id, approve), onSuccess: (d) => done(d.approved ? "Credited to the affiliate" : "Dismissed")(), onError: fail });
  const release = useMutation({ mutationFn: (id) => affiliatesApi.adminReleaseProspect(id), onSuccess: done("Released"), onError: fail });
  const move = useMutation({ mutationFn: ({ id, affiliateId }) => affiliatesApi.reassignProspect(id, affiliateId), onSuccess: () => { setMoving(null); done("Moved")(); }, onError: fail });
  const counts = data?.counts || {};

  return (
    <div style={{ display: "grid", gap: 14, fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div role="group" aria-label="Show" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map(([k, l]) => {
            const on = filter === k;
            const n = k ? counts[k] : null;
            return (
              <button key={k || "all"} type="button" aria-pressed={on} onClick={() => setFilter(k)} style={{ ...btn, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, borderColor: on ? BRAND.navy : BRAND.border }}>
                {k === "matches" && n ? <FiAlertCircle size={13} /> : null}{l}{n ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
        <button type="button" style={primary} onClick={() => setAdding(true)}><FiPlus size={14} /> Register a family for an affiliate</button>
      </div>
      {adding && (
        <PopUp title="Register a family for an affiliate" subtitle="The family becomes the affiliate's prospect: if they sign up while the claim is open, the affiliate earns." onClose={() => setAdding(false)}>
          <AddForAffiliate affiliates={affiliates} onDone={() => setAdding(false)} />
        </PopUp>
      )}
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>
        A family an affiliate registers is theirs while the claim is open: if they sign up — code or no code — matched by phone or email, the affiliate earns.
        A sign-up with only the same name shows under <strong>Possible matches</strong> for you to decide.
      </p>

      <div style={{ ...card, overflowX: "auto" }}>
        <style>{`.pr-row { cursor: pointer; } .pr-row:hover td { background: ${BRAND.canvas}; } .pr-row:focus-visible { outline: 2px solid ${BRAND.sky}; outline-offset: -2px; }`}</style>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
          <thead><tr>{["Family", "Affiliate", "Interested in", "Follow-up", "Added", "Status", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(data?.prospects || []).map((p) => {
              const open = p.state.key === "open";
              const fu = open ? followUpTone(p.followUpOn) : null;
              return (
                <tr key={p.id} className="pr-row" tabIndex={0} title="Open this family"
                  onClick={(e) => { if (!e.target.closest("button, select, a")) openProspect(p); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) openProspect(p); }}>
                  <td style={td}>
                    <strong style={{ color: BRAND.navy, textDecoration: "underline", textDecorationColor: BRAND.skyBorder, textUnderlineOffset: 3 }}>{p.parentName}</strong>
                    <div style={{ fontSize: 12, color: BRAND.muted }}>{[p.phone, p.email].filter(Boolean).join(" · ") || "Details removed"}</div>
                    {p.childName && <div style={{ fontSize: 12, color: BRAND.muted }}>Child: {p.childName}{p.childAge ? ` (${p.childAge})` : ""}</div>}

                    {p.possibleMatch && open && (
                      <div style={{ marginTop: 8, padding: "9px 11px", borderRadius: 10, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12.5, color: BRAND.goldText, fontWeight: 700 }}>
                          Possible match: {p.possibleMatch.parent?.name} signed up for {p.possibleMatch.programmeLabel} on {formatDay(p.possibleMatch.at)}
                          {[p.possibleMatch.parent?.phone, p.possibleMatch.parent?.email].filter(Boolean).length ? ` (${[p.possibleMatch.parent?.phone, p.possibleMatch.parent?.email].filter(Boolean).join(" · ")})` : ""}
                        </span>
                        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" style={primary} disabled={decide.isPending} onClick={async () => { if (await askConfirm({ title: "Credit this sign-up?", message: `${p.possibleMatch.parent?.name}'s sign-up becomes ${p.affiliate?.name}'s referral, and they earn when the family pays.`, confirmLabel: "Credit it" })) decide.mutate({ id: p.id, approve: true }); }}><FiCheck size={13} /> Same family — credit it</button>
                          <button type="button" style={btn} disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, approve: false })}>Not the same</button>
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={td}>{p.affiliate ? <>{p.affiliate.name}<div style={{ fontSize: 12, color: BRAND.muted }}>{p.affiliate.code}</div></> : "—"}</td>
                  <td style={td}>{p.programmeLabel || "—"}</td>
                  <td style={{ ...td, maxWidth: 280 }}>
                    {fu && <span style={{ ...pill(fu.tone), marginBottom: 4 }}>{fu.label}</span>}
                    {p.latestNote ? (
                      <div style={{ fontSize: 12.5, color: BRAND.inkSoft, lineHeight: 1.45 }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.latestNote.body}</span>
                        <span style={{ fontSize: 11.5, color: BRAND.faint }}>{p.latestNote.authorName || "Our team"} · {formatDay(p.latestNote.at)}{p.noteCount > 1 ? ` · ${p.noteCount} notes` : ""}</span>
                      </div>
                    ) : p.notes ? (
                      <div style={{ fontSize: 12.5, color: BRAND.inkSoft, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.notes}</div>
                    ) : <span style={{ fontSize: 12.5, color: BRAND.faint }}>{open ? "No notes yet" : "—"}</span>}
                  </td>
                  <td style={td}>{formatDay(p.createdAt)}<div style={{ fontSize: 12, color: BRAND.muted }}>{p.source === "bulk" ? "From a list" : p.source === "admin" ? "By our team" : "By the affiliate"}{p.invitedAt ? ` · invited ${formatDay(p.invitedAt)}` : ""}</div></td>
                  <td style={td}>
                    <span style={pill(TONE[p.state.key] || "neutral")}>{p.state.label}</span>
                    <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>{open ? `Ends ${formatDay(p.expiresAt)} · ${p.state.daysLeft} days` : p.closedReason || (p.convertedAt ? `Signed up ${formatDay(p.convertedAt)}` : "")}</div>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {open && (moving === p.id ? (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <select style={{ ...input, width: 180, padding: "6px 8px" }} defaultValue="" onChange={(e) => e.target.value && move.mutate({ id: p.id, affiliateId: e.target.value })}>
                          <option value="">Move to…</option>
                          {affiliates.filter((a) => a.status === "active" && a.id !== p.affiliateId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <button type="button" style={btn} onClick={() => setMoving(null)} aria-label="Cancel"><FiX size={13} /></button>
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button type="button" style={btn} onClick={() => setMoving(p.id)}><FiRepeat size={13} /> Move</button>
                        <button type="button" style={btn} onClick={async () => { if (await askConfirm({ title: `Release ${p.parentName}?`, message: "The claim ends and the family's details are removed. A later sign-up won't be credited to this affiliate.", confirmLabel: "Release", tone: "danger" })) release.mutate(p.id); }}>Release</button>
                      </span>
                    ))}
                    <HistoryButton type="affiliate_prospects" id={p.id} label={p.parentName} iconOnly />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && !data?.prospects?.length && <p style={{ margin: 0, padding: "28px 16px", textAlign: "center", color: BRAND.muted, fontSize: 13.5 }}>{filter === "matches" ? "No possible matches to decide." : "No families here."}</p>}
      </div>
    </div>
  );
}
