import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiDownload, FiSearch, FiUsers, FiUser, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { BRAND, card, cardHeading, pill } from "../../../theme/brand";
import { askText } from "../../../components/ui/AskDialog";
import { useCompetitionRegistrations, useCancelCompetitionRegistration } from "../hooks/useCompetitions";

/*
 * A competition's registrations from the website (20 Nov 2026): individuals and teams, filtered by
 * track, type and state, each with its contact, participants and invoice; Cancel (an unpaid invoice
 * is cancelled with it; the person is emailed); a spreadsheet of what's shown.
 */

const STATE = {
  pending_payment: { label: "Waiting for payment", tone: "waiting" },
  confirmed: { label: "Confirmed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
const ROLE = { parent: "Parent / guardian", teacher: "Teacher", school: "School", participant: "Participant", other: "Other" };

const money = (n, currency = "KES") => `${currency} ${Number(n || 0).toLocaleString("en-KE")}`;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");

function Figure({ label, value, tone }) {
  return (
    <div style={{ ...card, padding: "14px 16px", flex: "1 1 150px" }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: tone || BRAND.navy }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: BRAND.muted }}>{label}</p>
    </div>
  );
}

function csvOf(rows) {
  const head = ["Registration", "Registered on", "Track", "Entry", "Team", "School / organisation", "Participants", "Ages", "Contact", "Role", "Email", "Phone", "Fee", "Paid", "Invoice", "State"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [
    r.registrationNumber, day(r.createdAt), r.trackName, r.entryType === "group" ? "Team" : "Individual", r.teamName || "", r.organisation || "",
    r.participants.map((p) => p.name).join("; "), r.participants.map((p) => p.age ?? "").join("; "),
    r.contactName, ROLE[r.contactRole] || "", r.contactEmail, r.contactPhone,
    r.amount, r.invoice ? r.invoice.amountPaid : 0, r.invoice?.invoiceNumber || "", STATE[r.status]?.label || r.status,
  ].map(esc).join(","));
  return [head.map(esc).join(","), ...lines].join("\n");
}

function RegistrationRow({ reg, onCancel, cancelling }) {
  const [open, setOpen] = useState(false);
  const state = STATE[reg.status] || STATE.pending_payment;
  const who = reg.entryType === "group" ? `Team ${reg.teamName}` : reg.participants[0]?.name;
  return (
    <div style={{ borderBottom: `1px solid ${BRAND.line}` }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", flexWrap: "wrap" }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: reg.entryType === "group" ? BRAND.goldTint : BRAND.skyTint, color: reg.entryType === "group" ? BRAND.goldText : BRAND.skyText }}>
          {reg.entryType === "group" ? <FiUsers size={16} /> : <FiUser size={16} />}
        </span>
        <span style={{ flex: "1 1 220px", minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{who}</span>
          <span style={{ display: "block", fontSize: 12, color: BRAND.muted, marginTop: 2 }}>
            {reg.trackName} · {reg.entryType === "group" ? `${reg.participantCount} members` : "Individual"} · {reg.registrationNumber} · {day(reg.createdAt)}
          </span>
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, whiteSpace: "nowrap" }}>{reg.amount > 0 ? money(reg.amount, reg.currency) : "Free"}</span>
        <span style={pill(state.tone)}>{state.label}</span>
        {open ? <FiChevronUp size={16} color={BRAND.faint} /> : <FiChevronDown size={16} color={BRAND.faint} />}
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px 62px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div>
            <p style={{ ...cardHeading, marginBottom: 6 }}>{reg.entryType === "group" ? "Members" : "Participant"}</p>
            {reg.participants.map((p, i) => (
              <p key={i} style={{ margin: "0 0 4px", fontSize: 13, color: BRAND.inkSoft }}>
                <strong>{p.name}</strong>{p.age != null ? ` · ${p.age} yrs` : ""}{p.school ? ` · ${p.school}` : ""}
              </p>
            ))}
            {reg.organisation && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: BRAND.muted }}>School / organisation: {reg.organisation}</p>}
          </div>
          <div>
            <p style={{ ...cardHeading, marginBottom: 6 }}>Registered by</p>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: BRAND.inkSoft }}><strong>{reg.contactName}</strong>{reg.contactRole ? ` · ${ROLE[reg.contactRole] || reg.contactRole}` : ""}</p>
            <p style={{ margin: "0 0 4px", fontSize: 13 }}><a href={`mailto:${reg.contactEmail}`} style={{ color: BRAND.mid }}>{reg.contactEmail}</a></p>
            <p style={{ margin: 0, fontSize: 13 }}><a href={`tel:${reg.contactPhone}`} style={{ color: BRAND.mid }}>{reg.contactPhone}</a></p>
          </div>
          <div>
            <p style={{ ...cardHeading, marginBottom: 6 }}>Payment</p>
            {reg.invoice ? (
              <p style={{ margin: "0 0 4px", fontSize: 13, color: BRAND.inkSoft }}>
                <Link to={`/billing/${reg.invoice.id}`} style={{ color: BRAND.mid, fontWeight: 700 }}>{reg.invoice.invoiceNumber}</Link>
                {" "}· {money(reg.invoice.amountPaid, reg.currency)} of {money(reg.invoice.total, reg.currency)} paid
              </p>
            ) : (
              <p style={{ margin: "0 0 4px", fontSize: 13, color: BRAND.muted }}>Free entry — no invoice</p>
            )}
            {reg.status === "cancelled" ? (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: BRAND.muted }}>Cancelled {day(reg.cancelledAt)}{reg.cancelReason ? ` — ${reg.cancelReason}` : ""}</p>
            ) : (
              <button type="button" disabled={cancelling} onClick={() => onCancel(reg)} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${BRAND.dangerBorder}`, background: "#fff", color: BRAND.danger, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: cancelling ? "default" : "pointer" }}>
                Cancel registration
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompetitionRegistrations({ competition }) {
  const { data: rows = [], isLoading } = useCompetitionRegistrations(competition.id);
  const cancel = useCancelCompetitionRegistration(competition.id);
  const [track, setTrack] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [q, setQ] = useState("");

  const shown = useMemo(() => rows.filter((r) => {
    if (track && r.trackId !== track) return false;
    if (type && r.entryType !== type) return false;
    if (state && r.status !== state) return false;
    if (q) {
      const hay = [r.registrationNumber, r.teamName, r.organisation, r.contactName, r.contactEmail, r.contactPhone, ...r.participants.map((p) => p.name)].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, track, type, state, q]);

  const live = rows.filter((r) => r.status !== "cancelled");
  const confirmed = live.filter((r) => r.status === "confirmed");
  const participants = live.reduce((n, r) => n + r.participantCount, 0);
  const paid = live.reduce((n, r) => n + (r.invoice?.amountPaid || 0), 0);
  const currency = rows[0]?.currency || "KES";

  const onCancel = async (reg) => {
    const reason = await askText({
      title: `Cancel ${reg.entryType === "group" ? `Team ${reg.teamName}` : reg.participants[0]?.name}'s registration?`,
      message: reg.invoice && reg.invoice.amountPaid > 0
        ? "They've paid — the invoice stays as it is; arrange any refund separately. They're emailed that it's cancelled."
        : "Its unpaid invoice is cancelled too. They're emailed that it's cancelled.",
      label: "Why (included in the email)",
      required: true,
      confirmLabel: "Cancel registration",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (reason) cancel.mutate({ registrationId: reg.id, reason });
  };

  const download = () => {
    const blob = new Blob([csvOf(shown)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${competition.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const select = { padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", background: "#fff" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Figure label="Registrations" value={live.length} />
        <Figure label="Confirmed" value={confirmed.length} />
        <Figure label="Waiting for payment" value={live.length - confirmed.length} tone={BRAND.goldText} />
        <Figure label="Participants" value={participants} />
        <Figure label="Paid so far" value={money(paid, currency)} />
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: 12, borderBottom: `1px solid ${BRAND.line}` }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <FiSearch size={14} color={BRAND.faint} style={{ position: "absolute", left: 10, top: 11 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, team, email, number" style={{ ...select, width: "100%", paddingLeft: 30, boxSizing: "border-box" }} />
          </div>
          <select value={track} onChange={(e) => setTrack(e.target.value)} style={select} aria-label="Track">
            <option value="">All tracks</option>
            {(competition.tracks || []).map((t, i) => <option key={t.id || i} value={t.id || `track-${i + 1}`}>{t.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} style={select} aria-label="Entry">
            <option value="">Individuals and teams</option>
            <option value="individual">Individuals</option>
            <option value="group">Teams</option>
          </select>
          <select value={state} onChange={(e) => setState(e.target.value)} style={select} aria-label="State">
            <option value="">Every state</option>
            {Object.entries(STATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button type="button" onClick={download} disabled={!shown.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.navy, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: shown.length ? "pointer" : "default" }}>
            <FiDownload size={14} /> Spreadsheet
          </button>
        </div>

        {isLoading ? (
          <p style={{ margin: 0, padding: 20, fontSize: 13, color: BRAND.muted }}>Loading registrations…</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, padding: 20, fontSize: 13, color: BRAND.muted }}>
            No registrations yet. People register from each track&rsquo;s Register Now button on the website once the competition is Open, public and inside its registration dates.
          </p>
        ) : shown.length === 0 ? (
          <p style={{ margin: 0, padding: 20, fontSize: 13, color: BRAND.muted }}>No registrations match these filters.</p>
        ) : (
          shown.map((r) => <RegistrationRow key={r.id} reg={r} onCancel={onCancel} cancelling={cancel.isPending} />)
        )}
      </div>
    </div>
  );
}
