import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCalendar, FiCheck, FiClock, FiMail, FiMessageSquare, FiPhone, FiRepeat, FiTrash2, FiUser, FiUsers, FiX, FiAlertCircle } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import { askConfirm } from "../../../components/ui/AskDialog";
import { HistoryButton } from "../../activity/components/RecordStamp";
import { affiliatesApi, errorOf, formatDay } from "../services/affiliatesApi";

// One prospect (Affiliates → Prospects → a family, /affiliates/prospects/:id — 24 Nov 2026): the
// family's details, who registered them and when, where the claim stands, a possible match to decide,
// and the team's follow-up — a date to get back to them and a thread of notes (only the team sees
// them; they go with the family's details if the claim closes without a sign-up).

const TONE = { open: "waiting", signed_up: "good", paying: "strong", lost: "neutral", expired: "neutral", released: "neutral", opted_out: "neutral", cancelled: "neutral" };
const btn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", minHeight: 40, borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };
const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, fontSize: 14, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
const SOURCE = { portal: "Added by the affiliate", bulk: "From the affiliate's uploaded list", admin: "Added by our team" };

const todayKey = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // Kenyan date
const addDays = (n) => new Date(Date.now() + 3 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
export function followUpTone(date) {
  if (!date) return null;
  const t = todayKey();
  if (date < t) return { tone: "danger", label: `Follow up was due ${formatDay(date)}` };
  if (date === t) return { tone: "waiting", label: "Follow up today" };
  return { tone: "info", label: `Follow up ${formatDay(date)}` };
}

function useWide(min) {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= min : true));
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= min);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [min]);
  return wide;
}

function Row({ icon: Icon, label, children }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${BRAND.line}` }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 9, background: BRAND.skyTint, color: BRAND.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ fontSize: 14.5, color: BRAND.ink, marginTop: 2, overflowWrap: "anywhere" }}>{children}</div>
      </div>
    </div>
  );
}

export default function ProspectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const wide = useWide(1000);
  const key = ["affiliates", "prospect", id];
  const { data: p, isLoading, error } = useQuery({ queryKey: key, queryFn: () => affiliatesApi.prospect(id) });
  const { data: affiliates = [] } = useQuery({ queryKey: ["affiliates", "list"], queryFn: affiliatesApi.list });
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState(false);

  const refresh = (d) => {
    if (d) qc.setQueryData(key, d); else qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["affiliates", "prospects-admin"] });
  };
  const fail = (err) => toast.error(errorOf(err));
  const addNote = useMutation({ mutationFn: () => affiliatesApi.addProspectNote(id, note), onSuccess: (d) => { refresh(d); setNote(""); toast.success("Note added"); }, onError: fail });
  const followUp = useMutation({ mutationFn: (date) => affiliatesApi.setProspectFollowUp(id, date), onSuccess: (d) => { refresh(d); toast.success(d.followUpOn ? `Follow up on ${formatDay(d.followUpOn)}` : "Follow-up date cleared"); }, onError: fail });
  const decide = useMutation({ mutationFn: (approve) => affiliatesApi.decideMatch(id, approve), onSuccess: (d) => { refresh(); qc.invalidateQueries({ queryKey: ["affiliates", "referrals"] }); toast.success(d.approved ? "Credited to the affiliate" : "Dismissed"); }, onError: fail });
  const release = useMutation({ mutationFn: () => affiliatesApi.adminReleaseProspect(id), onSuccess: () => { refresh(); toast.success("Released"); }, onError: fail });
  const move = useMutation({ mutationFn: (affiliateId) => affiliatesApi.reassignProspect(id, affiliateId), onSuccess: () => { refresh(); setMoving(false); toast.success("Moved"); }, onError: fail });
  const removeNote = async (n) => {
    if (!(await askConfirm({ title: "Delete this note?", confirmLabel: "Delete", tone: "danger" }))) return;
    try { refresh(await affiliatesApi.deleteProspectNote(id, n.id)); } catch (err) { fail(err); }
  };

  const back = <button type="button" onClick={() => navigate("/affiliates?tab=prospects")} style={{ ...btn, borderRadius: 999, justifySelf: "start" }}><FiArrowLeft /> Prospects</button>;
  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: BRAND.faint, fontFamily: FONT }}>Loading…</div>;
  if (error) return <div style={{ display: "grid", gap: 14, fontFamily: FONT }}>{back}<div style={{ ...card, padding: 24, color: BRAND.danger }}>{errorOf(error)}</div></div>;

  const open = p.state.key === "open";
  const keepsDetails = open || p.status === "signed_up";
  const fu = followUpTone(p.followUpOn);
  const otherAffiliates = (Array.isArray(affiliates) ? affiliates : []).filter((a) => a.status === "active" && a.id !== p.affiliateId);

  return (
    <div style={{ display: "grid", gap: 16, fontFamily: FONT, width: "100%" }}>
      {back}
      <header style={{ background: HERO_GRADIENT, color: "#fff", borderRadius: 20, padding: wide ? "22px 26px" : "18px 18px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.gold }}>Prospect</div>
          <h1 style={{ margin: "4px 0 6px", fontSize: wide ? 26 : 22, fontWeight: 900 }}>{p.parentName}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13.5 }}>
            <span style={{ ...pill(TONE[p.state.key] || "neutral"), fontSize: 12.5 }}>{p.state.label}</span>
            {open && <span style={{ opacity: 0.9 }}>Claim ends {formatDay(p.expiresAt)} · {p.state.daysLeft} {p.state.daysLeft === 1 ? "day" : "days"} left</span>}
            {fu && open && <span style={{ ...pill(fu.tone), fontSize: 12.5 }}><FiCalendar size={12} /> {fu.label}</span>}
          </div>
        </div>
        {open && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={{ ...btn, background: "rgba(255,255,255,0.14)", color: "#fff", borderColor: "rgba(255,255,255,0.4)" }} onClick={() => setMoving((m) => !m)}><FiRepeat size={14} /> Move to another affiliate</button>
            <button type="button" style={{ ...btn, background: "rgba(255,255,255,0.14)", color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
              onClick={async () => { if (await askConfirm({ title: `Release ${p.parentName}?`, message: "The claim ends and the family's details and follow-up notes are removed. A later sign-up won't be credited to this affiliate.", confirmLabel: "Release", tone: "danger" })) release.mutate(); }}>
              <FiX size={14} /> Release
            </button>
          </div>
        )}
      </header>

      {moving && open && (
        <div style={{ ...card, padding: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: BRAND.inkSoft }}>Move {p.parentName} to</span>
          <select aria-label="Affiliate" defaultValue="" onChange={(e) => e.target.value && move.mutate(e.target.value)} style={{ ...input, width: "auto", minWidth: 240, maxWidth: "100%" }}>
            <option value="">Choose an affiliate…</option>
            {otherAffiliates.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}
          </select>
          <span style={{ fontSize: 12.5, color: BRAND.muted }}>The claim keeps its end date. Neither affiliate is told.</span>
          <button type="button" style={btn} onClick={() => setMoving(false)}>Cancel</button>
        </div>
      )}

      {p.possibleMatch && open && (
        <div role="status" style={{ ...card, padding: 16, background: BRAND.goldTint, borderColor: BRAND.goldBorder, display: "grid", gap: 10 }}>
          <strong style={{ color: BRAND.goldText, display: "flex", gap: 8, alignItems: "center" }}><FiAlertCircle /> Possible match to decide</strong>
          <span style={{ fontSize: 14, color: BRAND.goldText }}>
            {p.possibleMatch.parent?.name} signed up for {p.possibleMatch.programmeLabel} on {formatDay(p.possibleMatch.at)}
            {[p.possibleMatch.parent?.phone, p.possibleMatch.parent?.email].filter(Boolean).length ? ` (${[p.possibleMatch.parent?.phone, p.possibleMatch.parent?.email].filter(Boolean).join(" · ")})` : ""} — the same parent name, but a different phone or email.
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={primary} disabled={decide.isPending} onClick={async () => { if (await askConfirm({ title: "Credit this sign-up?", message: `${p.possibleMatch.parent?.name}'s sign-up becomes ${p.affiliate?.name}'s referral, and they earn when the family pays.`, confirmLabel: "Credit it" })) decide.mutate(true); }}><FiCheck size={14} /> Same family — credit it</button>
            <button type="button" style={btn} disabled={decide.isPending} onClick={() => decide.mutate(false)}>Not the same</button>
          </span>
        </div>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: wide ? "minmax(0, 1fr) minmax(0, 1.15fr)" : "100%", alignItems: "start" }}>
        {/* On a phone the column dissolves, so the order is: the family, the follow-up, the claim. */}
        <div style={{ display: wide ? "grid" : "contents", gap: 16, minWidth: 0 }}>
          <section style={{ ...card, padding: "18px 20px", order: 1 }}>
            <h2 style={cardHeading}><FiUser size={13} /> The family</h2>
            {keepsDetails ? (
              <>
                <Row icon={FiUser} label="Parent">{p.parentName}</Row>
                <Row icon={FiPhone} label="Phone">{p.phone ? <a href={`tel:${p.phone}`} style={{ color: BRAND.mid, fontWeight: 700 }}>{p.phone}</a> : "—"}</Row>
                <Row icon={FiMail} label="Email">{p.email ? <a href={`mailto:${p.email}`} style={{ color: BRAND.mid, fontWeight: 700 }}>{p.email}</a> : "—"}</Row>
                <Row icon={FiUsers} label="Child">{p.childName ? `${p.childName}${p.childAge ? `, ${p.childAge}` : ""}` : p.childAge ? `Aged ${p.childAge}` : "—"}</Row>
                <Row icon={FiCheck} label="Interested in">{p.programmeLabel || "Not sure yet"}</Row>
              </>
            ) : (
              <p style={{ margin: "10px 0 0", fontSize: 14, color: BRAND.muted }}>This claim closed without a sign-up, so the family&apos;s details and notes were removed (only the first name is kept).{p.closedReason ? ` ${p.closedReason}.` : ""}</p>
            )}
          </section>

          <section style={{ ...card, padding: "18px 20px", order: 3 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h2 style={cardHeading}><FiClock size={13} /> The claim</h2>
              <HistoryButton type="affiliate_prospects" id={p.id} label={p.parentName} />
            </div>
            <Row icon={FiUser} label="Affiliate">
              {p.affiliate ? <>{p.affiliate.name} <span style={{ color: BRAND.muted }}>· {p.affiliate.code}</span>{p.affiliate.status !== "active" && <span style={{ ...pill("neutral"), marginLeft: 6 }}>{p.affiliate.status}</span>}</> : "—"}
            </Row>
            <Row icon={FiCalendar} label="Added">{formatDay(p.createdAt)} · {SOURCE[p.source] || "Added"}{p.createdByName ? ` (${p.createdByName})` : ""}</Row>
            <Row icon={FiClock} label={open ? "Claim ends" : "Claim"}>{open ? `${formatDay(p.expiresAt)} — ${p.state.daysLeft} ${p.state.daysLeft === 1 ? "day" : "days"} left (claims last ${p.claimDays} days)` : p.closedReason || p.state.label}</Row>
            <Row icon={FiMessageSquare} label="Invited">{p.invitedAt ? `${formatDay(p.invitedAt)}${p.inviteCount > 1 ? ` · ${p.inviteCount} times` : ""}` : "Not yet"}</Row>
            {p.referral && <Row icon={FiCheck} label="Signed up">{p.referral.programmeLabel} on {formatDay(p.referral.createdAt)} · referral {p.referral.status}</Row>}
          </section>
        </div>

        <section style={{ ...card, padding: "18px 20px", display: "grid", gap: 14, minWidth: 0, order: 2 }}>
          <h2 style={cardHeading}><FiMessageSquare size={13} /> Follow-up</h2>

          {open && (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>Follow up on</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input type="date" aria-label="Follow up on" value={p.followUpOn || ""} min={todayKey()} onChange={(e) => followUp.mutate(e.target.value || null)} style={{ ...input, width: "auto", minWidth: 170 }} />
                {[["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([l, n]) => <button key={l} type="button" style={{ ...btn, padding: "7px 12px", minHeight: 36, fontSize: 12.5 }} onClick={() => followUp.mutate(addDays(n))}>{l}</button>)}
                {p.followUpOn && <button type="button" style={{ ...btn, padding: "7px 12px", minHeight: 36, fontSize: 12.5 }} onClick={() => followUp.mutate(null)}>Clear</button>}
              </div>
              {fu && <span style={{ ...pill(fu.tone), justifySelf: "start" }}><FiCalendar size={12} /> {fu.label}</span>}
            </div>
          )}

          {p.affiliateNote && keepsDetails && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: BRAND.canvas, border: `1px solid ${BRAND.line}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>From {p.source === "admin" ? "our team" : p.affiliate?.name || "the affiliate"}, when added</div>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: BRAND.ink, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{p.affiliateNote}</p>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {p.followUps.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>{keepsDetails ? "No follow-up notes yet. Note each call or message so anyone on the team can pick up where it was left." : "No notes."}</p>}
            {/* Newest first. */}
            {p.followUps.slice().reverse().map((n) => (
              <div key={n.id} style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${BRAND.border}`, background: "#fff" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 13, color: BRAND.ink }}>{n.authorName || "Our team"}</strong>
                  <span style={{ fontSize: 12, color: BRAND.faint, flex: 1 }}>{new Date(n.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <button type="button" aria-label="Delete note" title="Delete note" onClick={() => removeNote(n)} style={{ border: "none", background: "none", color: BRAND.faint, cursor: "pointer", width: 32, height: 32, display: "grid", placeItems: "center" }}><FiTrash2 size={14} /></button>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: BRAND.inkSoft, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.body}</p>
              </div>
            ))}
          </div>

          {keepsDetails && (
            <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(); }} style={{ display: "grid", gap: 8 }}>
              <label htmlFor="pr-note" style={{ fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>Add a follow-up note</label>
              <textarea id="pr-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called 24 Nov — mum wants weekend classes, will decide after school closes." style={{ ...input, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: BRAND.muted }}>Only our team sees these notes.</span>
                <button type="submit" style={{ ...primary, opacity: note.trim() ? 1 : 0.6 }} disabled={!note.trim() || addNote.isPending}>{addNote.isPending ? "Saving…" : "Add note"}</button>
              </div>
            </form>
          )}
          {!open && p.status !== "signed_up" && <Link to="/affiliates?tab=prospects" style={{ fontSize: 13, color: BRAND.mid }}>Back to all prospects</Link>}
        </section>
      </div>
    </div>
  );
}
