import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import toast from "react-hot-toast";
import {
  FiArrowLeft, FiBarChart2, FiCalendar, FiCamera, FiCheck, FiCheckCircle, FiClock, FiCopy, FiDownload, FiEdit2, FiExternalLink, FiMail,
  FiMapPin, FiMonitor, FiPlus, FiSearch, FiSend, FiTrash2, FiUserCheck, FiUserPlus, FiUsers, FiX, FiXCircle,
} from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import { usePermissions } from "../../../hooks/usePermissions";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import RecordStamp from "../../activity/components/RecordStamp";
import TicketScanner from "../components/TicketScanner";
import { errorOf, generalEventsApi } from "../services/generalEventsApi";
import { useEventMutation, useEventRegistrations, useGeneralEvent } from "../hooks/useGeneralEvents";
import { EVENTS_CSS, REG_STATUS, SOURCE_LABEL, StatePill, btn, hintStyle, inputStyle, labelStyle, plural, shortDate, shortDateTime } from "../shared";

// One general event for admins and staff (/events/general/:id?tab=…): Overview (numbers and who's
// coming), Registrations (everyone, with what they told us; change, cancel, add), Check-in (on the
// day: tick people off, add walk-ins), Messages & invites (email the people registered; invite a
// bootcamp's families or everyone signed in).
const TABS = [
  { key: "overview", label: "Overview", icon: FiBarChart2 },
  { key: "registrations", label: "Registrations", icon: FiUsers },
  { key: "checkin", label: "Check-in", icon: FiUserCheck },
  { key: "messages", label: "Messages & invites", icon: FiMail },
];

function Kpi({ icon: Icon, label, value, note, tone = BRAND.navy }) {
  return (
    <div style={{ ...card, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, background: BRAND.skyTint, color: tone, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={17} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.ink, lineHeight: 1.2 }}>{value}</div>
        {note && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{note}</div>}
      </div>
    </div>
  );
}

function Bars({ title, rows, empty = "No answers yet" }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section style={{ ...card, padding: 18, display: "grid", gap: 10, alignContent: "start" }}>
      <h3 style={cardHeading}>{title}</h3>
      {rows.length === 0 || rows.every((r) => !r.count) ? <p style={{ margin: 0, ...hintStyle }}>{empty}</p> : rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: BRAND.inkSoft }}><span>{r.label}</span><strong>{r.count}</strong></div>
          <div style={{ height: 8, borderRadius: 4, background: BRAND.track }}><div style={{ height: 8, borderRadius: 4, width: `${(r.count / max) * 100}%`, background: BRAND.mid }} /></div>
        </div>
      ))}
    </section>
  );
}

const labelled = (counts, labels) => Object.entries(counts || {}).map(([k, count]) => ({ label: labels?.[k] || k, count })).sort((a, b) => b.count - a.count);

function Overview({ event }) {
  const s = event.stats;
  const q = event.public.questions;
  const capacityNote = s.capacity ? `${Math.max(0, s.capacity - s.people)} of ${s.capacity} places left` : "No limit";
  return (
    <div className="ge-page">
      <div className="ge-kpis">
        <Kpi icon={FiUsers} label="Coming" value={s.people} note={`${plural(s.registrations - s.waitlisted.registrations, "registration")} · ${capacityNote}`} />
        <Kpi icon={FiClock} label="Waiting list" value={s.waitlisted.people} note={s.waitlisted.registrations ? plural(s.waitlisted.registrations, "registration") : "Nobody waiting"} tone={BRAND.goldText} />
        <Kpi icon={FiUserCheck} label="Arrived" value={s.arrived.people} note={s.walkIns ? `incl. ${plural(s.walkIns, "walk-in")}` : "Ticked off at check-in"} />
        <Kpi icon={FiUserPlus} label="New to us" value={s.newPeople} note={`${s.alreadyFamilies} already families · ${s.joinedSince} joined since`} />
        <Kpi icon={FiMail} label="Happy to hear from us" value={s.consent} note={`${s.detailsDone} told us about themselves`} />
      </div>
      <section style={{ ...card, padding: 18 }}>
        <h3 style={cardHeading}><FiBarChart2 size={13} /> Registrations by day</h3>
        {s.byDay.length === 0 ? <p style={{ ...hintStyle, margin: "10px 0 0" }}>No one has registered yet. Share the link, or invite people from Messages &amp; invites.</p> : (
          <div style={{ width: "100%", height: 200, marginTop: 10 }}>
            <ResponsiveContainer>
              <BarChart data={s.byDay.map((d) => ({ ...d, label: shortDate(`${d.day}T12:00:00Z`).replace(/ \d{4}$/, "") }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BRAND.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: BRAND.muted }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: BRAND.muted }} />
                <Tooltip cursor={{ fill: BRAND.skyTint }} />
                <Bar dataKey="count" name="Registrations" fill={BRAND.navy} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <div className="ge-grid-3">
        <Bars title="Where they found it" rows={s.visitSources} empty="Nobody yet" />
        <Bars title="How they registered" rows={labelled(s.sources, SOURCE_LABEL)} empty="Nobody yet" />
        <Bars title="Who they are" rows={labelled(s.personTypes, q.personTypes)} />
        <Bars title="Interested in" rows={labelled(s.interests, q.interests)} />
        <Bars title="Children's ages" rows={s.ages} />
        <Bars title="Heard about us" rows={labelled(s.heardFrom, q.heardFrom)} />
      </div>
      <RecordStamp type="general_events" id={event.id} />
    </div>
  );
}

// ---- Registrations ------------------------------------------------------------------------------

function toCsv(rows, questions) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Name", "Email", "Phone", "People", "Status", "Arrived", "Registered", "How", "About them", "Organisation", "Children's ages", "Interested in", "Heard about us", "Happy to hear from us"];
  const lines = rows.map((r) => [
    r.name, r.email, r.phone, r.partySize, REG_STATUS[r.status]?.label || r.status, r.attendedAt ? shortDateTime(r.attendedAt) : "", shortDateTime(r.createdAt), SOURCE_LABEL[r.source] || r.source,
    questions.personTypes[r.personType] || "", r.organisation || "", (r.childrenAges || []).join(" "), (r.interests || []).map((k) => questions.interests[k] || k).join("; "),
    questions.heardFrom[r.heardFrom] || "", r.marketingConsent ? "Yes" : "No",
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

const copy = async (text, what) => {
  try { await navigator.clipboard.writeText(text); toast.success(what); } catch { toast.error("Couldn't copy"); }
};

function AddPersonDialog({ eventId, walkIn = false, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", partySize: 1 });
  const add = useEventMutation(eventId, (body) => generalEventsApi.addRegistration(eventId, body), walkIn ? "Walk-in added and marked arrived" : "Added");
  const submit = (e) => {
    e.preventDefault();
    add.mutate({ ...form, partySize: Number(form.partySize) || 1, walkIn }, { onSuccess: onClose });
  };
  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(10,22,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" style={{ ...card, width: "min(460px, 100%)", padding: 20, display: "grid", gap: 12, fontFamily: FONT }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: BRAND.ink }}>{walkIn ? "Add a walk-in" : "Add someone"}</h3>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: BRAND.muted }}><FiX size={18} /></button>
        </div>
        <p style={{ ...hintStyle, margin: 0 }}>{walkIn ? "They're here — they're added as arrived, whatever the places left." : "Takes a place like any registration (or the waiting list when full). They get the confirmation email."}</p>
        <label style={labelStyle}>Name<input required minLength={2} style={inputStyle} {...f("name")} autoFocus /></label>
        <label style={labelStyle}>Phone<input required inputMode="tel" style={inputStyle} {...f("phone")} placeholder="07…" /></label>
        <label style={labelStyle}>Email<input required type="email" style={inputStyle} {...f("email")} /></label>
        <label style={{ ...labelStyle, maxWidth: 160 }}>People<input type="number" min={1} max={20} style={inputStyle} {...f("partySize")} /></label>
        <div className="ge-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" style={btn()} onClick={onClose}>Cancel</button>
          <button type="submit" style={btn("primary")} disabled={add.isPending}>{add.isPending ? "Adding…" : walkIn ? "Add and mark arrived" : "Add"}</button>
        </div>
      </form>
    </div>
  );
}

function Registrations({ event, canEdit }) {
  const { data: regs = [], isLoading } = useEventRegistrations(event.id);
  const [filter, setFilter] = useState("live");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const update = useEventMutation(event.id, ({ regId, body }) => generalEventsApi.updateRegistration(event.id, regId, body), "Saved");
  const questions = event.public.questions;
  const FILTERS = {
    live: ["Coming or waiting", (r) => r.status !== "cancelled"],
    registered: ["Registered", (r) => r.status === "registered"],
    waitlisted: ["Waiting list", (r) => r.status === "waitlisted"],
    arrived: ["Arrived", (r) => !!r.attendedAt],
    cancelled: ["Cancelled", (r) => r.status === "cancelled"],
  };
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return regs.filter(FILTERS[filter][1]).filter((r) => !needle || `${r.name} ${r.email} ${r.phone} ${r.ticketCode || ""}`.toLowerCase().includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regs, filter, q]);
  const live = regs.filter((r) => r.status !== "cancelled");

  const changePeople = async (r) => {
    const value = await askText({ title: `People coming with ${r.name}`, message: "Everyone in their party, them included.", label: "People", required: true, placeholder: String(r.partySize) });
    if (value == null) return;
    const n = Math.round(Number(value));
    if (!(n >= 1 && n <= 50)) return toast.error("Type a number from 1 to 50");
    update.mutate({ regId: r.id, body: { partySize: n } });
  };
  const cancel = async (r) => {
    if (await askConfirm({ title: `Cancel ${r.name}'s registration?`, message: "Their place goes to the waiting list (if there is one). They aren't emailed.", confirmLabel: "Cancel registration", cancelLabel: "Keep", tone: "danger" })) {
      update.mutate({ regId: r.id, body: { status: "cancelled" } });
    }
  };

  return (
    <div className="ge-page">
      <div className="ge-row" style={{ justifyContent: "space-between" }}>
        <div className="ge-row">
          {Object.entries(FILTERS).map(([k, [label, test]]) => (
            <button key={k} type="button" className="ge-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} <span style={{ opacity: 0.7 }}>{regs.filter(test).length}</span></button>
          ))}
        </div>
        <div className="ge-row">
          <button type="button" style={btn()} onClick={() => download(`${event.slug}-registrations.csv`, toCsv(regs, questions))} disabled={!regs.length}><FiDownload size={14} /> Spreadsheet</button>
          <button type="button" style={btn()} onClick={() => copy(live.map((r) => r.email).join(", "), "Emails copied")} disabled={!live.length}><FiCopy size={14} /> Emails</button>
          <button type="button" style={btn()} onClick={() => copy(live.map((r) => r.phone).join(", "), "Phone numbers copied")} disabled={!live.length}><FiCopy size={14} /> Phones</button>
          {canEdit && <button type="button" style={btn("primary")} onClick={() => setAdding(true)}><FiPlus size={14} /> Add someone</button>}
        </div>
      </div>
      <label style={{ position: "relative", display: "block" }}>
        <FiSearch size={15} style={{ position: "absolute", left: 12, top: 13, color: BRAND.muted }} />
        <input style={{ ...inputStyle, paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or ticket" aria-label="Search registrations" />
      </label>
      {isLoading ? <p style={hintStyle}>Loading…</p> : shown.length === 0 ? <p style={{ ...hintStyle, margin: 0 }}>{regs.length ? "No one matches." : "No one has registered yet."}</p> : (
        <div style={{ display: "grid", gap: 10 }}>
          {shown.map((r) => {
            const s = REG_STATUS[r.status] || REG_STATUS.registered;
            return (
              <article key={r.id} style={{ ...card, padding: "14px 16px", display: "grid", gap: 8, opacity: r.status === "cancelled" ? 0.7 : 1 }}>
                <div className="ge-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ge-row" style={{ gap: 8 }}>
                      <strong style={{ fontSize: 15, color: BRAND.ink }}>{r.name}</strong>
                      <span style={pill(s.tone)}>{s.label}</span>
                      {r.attendedAt && <span style={pill("strong")}><FiCheck size={11} /> Arrived</span>}
                      {r.leadId && <Link to={`/enquiries?lead=${r.leadId}`} style={{ fontSize: 12, fontWeight: 700, color: BRAND.mid }}>Enquiry</Link>}
                    </div>
                    <div style={{ fontSize: 13, color: BRAND.inkSoft, marginTop: 3, overflowWrap: "anywhere" }}>
                      <a href={`mailto:${r.email}`} style={{ color: BRAND.inkSoft }}>{r.email}</a> · <a href={`tel:${r.phone.replace(/\s+/g, "")}`} style={{ color: BRAND.inkSoft }}>{r.phone}</a>
                    </div>
                    <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>
                      {r.status === "registered" && r.ticketCode ? <><span style={{ fontFamily: "Consolas, monospace", fontWeight: 700, color: BRAND.inkSoft }}>{r.ticketCode}</span> · </> : null}{plural(r.partySize, "person", "people")} · {SOURCE_LABEL[r.source] || r.source} · {shortDateTime(r.createdAt)}{r.marketingConsent ? " · happy to hear from us" : ""}
                    </div>
                  </div>
                  {canEdit && r.status !== "cancelled" && (
                    <div className="ge-row" style={{ gap: 6 }}>
                      {r.status === "waitlisted" && <button type="button" style={btn("primary", { minHeight: 32 })} onClick={() => update.mutate({ regId: r.id, body: { status: "registered" } })}>Give a place</button>}
                      <button type="button" style={btn("plain", { minHeight: 32 })} onClick={() => changePeople(r)}>People</button>
                      <button type="button" style={btn("danger", { minHeight: 32 })} onClick={() => cancel(r)}>Cancel</button>
                    </div>
                  )}
                </div>
                {(r.personType || (r.childrenAges || []).length || (r.interests || []).length || r.heardFrom) && (
                  <div className="ge-row" style={{ gap: 6 }}>
                    {r.personType && <span style={pill("info")}>{questions.personTypes[r.personType]}{r.organisation ? ` · ${r.organisation}` : ""}</span>}
                    {(r.childrenAges || []).length > 0 && <span style={pill("neutral")}>Children {r.childrenAges.join(", ")}</span>}
                    {(r.interests || []).map((k) => <span key={k} style={pill("good")}>{questions.interests[k] || k}</span>)}
                    {r.heardFrom && <span style={pill("neutral")}>Heard: {questions.heardFrom[r.heardFrom]}</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {adding && <AddPersonDialog eventId={event.id} onClose={() => setAdding(false)} />}
    </div>
  );
}

// ---- Check-in -----------------------------------------------------------------------------------

function CheckIn({ event, canEdit }) {
  const { data: regs = [] } = useEventRegistrations(event.id, { refetchInterval: 20000 });
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("ticket") || "");
  const [walkIn, setWalkIn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const mark = useEventMutation(event.id, ({ regId, arrived }) => generalEventsApi.arrived(event.id, regId, arrived), null);
  const live = regs.filter((r) => r.status !== "cancelled");
  const needle = q.trim().toLowerCase();
  const shown = live
    .filter((r) => !needle || `${r.name} ${r.email} ${r.phone} ${r.ticketCode || ""}`.toLowerCase().includes(needle))
    .sort((a, b) => Number(!!a.attendedAt) - Number(!!b.attendedAt) || a.name.localeCompare(b.name));
  const arrivedPeople = live.filter((r) => r.attendedAt).reduce((s, r) => s + r.partySize, 0);
  const expected = live.filter((r) => r.status === "registered").reduce((s, r) => s + r.partySize, 0);

  return (
    <div className="ge-page">
      <div style={{ ...card, padding: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: BRAND.ink }}>{arrivedPeople} <span style={{ fontSize: 15, color: BRAND.muted, fontWeight: 700 }}>of {expected} people arrived</span></div>
          <div style={{ height: 8, borderRadius: 4, background: BRAND.track, marginTop: 6, width: "min(320px, 70vw)" }}><div style={{ height: 8, borderRadius: 4, background: BRAND.mid, width: `${expected ? Math.min(100, (arrivedPeople / expected) * 100) : 0}%` }} /></div>
        </div>
        <div className="ge-row">
          <button type="button" style={btn("primary", { minHeight: 46 })} onClick={() => setScanning(true)}><FiCamera size={16} /> Scan tickets</button>
          {canEdit && <button type="button" style={btn("gold", { minHeight: 46 })} onClick={() => setWalkIn(true)}><FiUserPlus size={16} /> Walk-in</button>}
        </div>
      </div>
      <label style={{ position: "relative", display: "block" }}>
        <FiSearch size={16} style={{ position: "absolute", left: 14, top: 15, color: BRAND.muted }} />
        <input style={{ ...inputStyle, padding: "13px 14px 13px 40px", fontSize: 16 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone by name, phone or ticket code" aria-label="Find someone" />
      </label>
      <div style={{ display: "grid", gap: 8 }}>
        {shown.length === 0 && <p style={{ ...hintStyle, margin: 0 }}>{live.length ? "No one matches — add them as a walk-in." : "No one registered yet."}</p>}
        {shown.map((r) => {
          const here = !!r.attendedAt;
          return (
            <div key={r.id} style={{ ...card, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", borderColor: here ? BRAND.skyBorder : BRAND.border, background: here ? BRAND.skyTint : "#fff" }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 15, color: BRAND.ink }}>{r.name}</strong>
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>{r.status === "registered" && r.ticketCode ? `${r.ticketCode} · ` : ""}{plural(r.partySize, "person", "people")} · {r.phone}{r.status === "waitlisted" ? " · on the waiting list" : ""}</div>
              </div>
              {canEdit && (
                <button type="button" onClick={() => mark.mutate({ regId: r.id, arrived: !here })}
                  style={btn(here ? "plain" : "primary", { minHeight: 44, minWidth: 116 })} aria-pressed={here}>
                  {here ? <><FiCheckCircle size={15} color={BRAND.mid} /> Arrived</> : "Mark arrived"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {walkIn && <AddPersonDialog eventId={event.id} walkIn onClose={() => setWalkIn(false)} />}
      {scanning && <TicketScanner event={event} canLetIn={canEdit} onClose={() => setScanning(false)} />}
    </div>
  );
}

// ---- Messages & invites -------------------------------------------------------------------------

const TEMPLATES = (event) => ({
  reminder: { to: "registered", subject: `See you soon: ${event.title}`, body: `Just a reminder that ${event.title} is on ${event.when}.\n\nWhere: ${event.where}.\n\nCan't make it any more? Please cancel from your registration page so someone else can have your place.` },
  thanks: { to: "came", subject: `Thank you for coming to ${event.title}`, body: "Thank you for coming — it was wonderful to have you with us.\n\nIf your child would like to start their own journey, our next bootcamp and pathways are open for registration. Reply to this email and we'll help you pick the right one." },
  missed: { to: "missed", subject: `We missed you at ${event.title}`, body: "Sorry we didn't see you this time.\n\nWe'd still love to show you what our learners do — reply to this email and we'll tell you about the next event, or set up a time to chat." },
});

function Messages({ event, canEdit }) {
  const [form, setForm] = useState({ to: "registered", subject: "", body: "" });
  const send = useEventMutation(event.id, (body) => generalEventsApi.message(event.id, body), (r) => `Sent to ${plural(r.sent, "person", "people")}`);
  const invite = useEventMutation(event.id, (audience) => generalEventsApi.invite(event.id, audience), (r) => `Invited: ${r.emailed ? `${plural(r.emailed, "family", "families")} emailed` : ""}${r.emailed && r.notified ? " · " : ""}${r.notified ? `${plural(r.notified, "person", "people")} notified in the system` : ""}${!r.emailed && !r.notified ? "nobody new to invite" : ""}`);
  const s = event.stats;
  const counts = { everyone: s.registrations, registered: s.registrations - s.waitlisted.registrations, waitlisted: s.waitlisted.registrations, came: s.arrived.registrations, missed: Math.max(0, s.registrations - s.waitlisted.registrations - s.arrived.registrations) };
  const TO = { registered: "Everyone with a place", waitlisted: "The waiting list", everyone: "Everyone (places and waiting list)", came: "The people who came", missed: "The people who didn't come" };
  const upcoming = event.state === "upcoming";
  const submit = async (e) => {
    e.preventDefault();
    if (!counts[form.to]) return toast.error("Nobody in that group yet");
    if (await askConfirm({ title: `Email ${plural(counts[form.to], "person", "people")}?`, message: `“${form.subject}” goes to ${TO[form.to].toLowerCase()}.`, confirmLabel: "Send" })) {
      send.mutate(form, { onSuccess: () => setForm((f) => ({ ...f, subject: "", body: "" })) });
    }
  };
  const doInvite = async (audience) => {
    const text = audience === "bootcamp"
      ? `Every family of ${event.bootcampName} gets an email invitation (and the bell, if they sign in). Families already registered are skipped. Each family is only ever invited once.`
      : "Everyone signed in to your workspace who gets this event's sign-in pop-up also gets the bell (and an email if they allow it). Each person only once.";
    if (await askConfirm({ title: "Send the invitations?", message: text, confirmLabel: "Invite" })) invite.mutate(audience);
  };
  return (
    <div className="ge-page">
      {canEdit && upcoming && event.status === "published" && (
        <section style={{ ...card, padding: 18, display: "grid", gap: 12 }}>
          <h3 style={cardHeading}><FiUserPlus size={13} /> Invite people</h3>
          <div className="ge-grid-2">
            <div style={{ border: `1.5px solid ${BRAND.line}`, borderRadius: 12, padding: 14, display: "grid", gap: 8, alignContent: "start" }}>
              <strong style={{ color: BRAND.ink }}>The bootcamp&rsquo;s families</strong>
              <span style={hintStyle}>{event.bootcampName ? `An email to every parent of ${event.bootcampName} — with or without a login.` : "Link the event to a bootcamp (Edit) to invite its families."}</span>
              <div><button type="button" style={btn("primary")} disabled={!event.bootcampId || invite.isPending} onClick={() => doInvite("bootcamp")}><FiSend size={14} /> Invite families</button></div>
            </div>
            <div style={{ border: `1.5px solid ${BRAND.line}`, borderRadius: 12, padding: 14, display: "grid", gap: 8, alignContent: "start" }}>
              <strong style={{ color: BRAND.ink }}>Everyone in the system</strong>
              <span style={hintStyle}>The bell for everyone who gets the sign-in pop-up (on top of the pop-up itself).</span>
              <div><button type="button" style={btn()} disabled={invite.isPending} onClick={() => doInvite("everyone")}><FiSend size={14} /> Notify everyone</button></div>
            </div>
          </div>
        </section>
      )}
      {canEdit && (
        <form onSubmit={submit} style={{ ...card, padding: 18, display: "grid", gap: 12 }}>
          <h3 style={cardHeading}><FiMail size={13} /> Email the people registered</h3>
          <div className="ge-row">
            <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>Start from:</span>
            {Object.entries({ reminder: "Reminder", thanks: "Thank you for coming", missed: "Sorry we missed you" }).map(([k, label]) => (
              <button key={k} type="button" className="ge-chip" onClick={() => setForm(TEMPLATES(event)[k])}>{label}</button>
            ))}
          </div>
          <label style={labelStyle}>To
            <select style={inputStyle} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
              {Object.entries(TO).map(([k, label]) => <option key={k} value={k}>{label} ({counts[k]})</option>)}
            </select>
          </label>
          <label style={labelStyle}>Subject<input required minLength={3} style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label style={labelStyle}>Message
            <textarea required minLength={5} rows={7} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <span style={hintStyle}>A blank line starts a new paragraph. Before the event, the email also shows when and where{event.format !== "in_person" ? " and the join link" : ""}, and a button to their registration.</span>
          </label>
          <div><button type="submit" style={btn("primary")} disabled={send.isPending}><FiSend size={14} /> {send.isPending ? "Sending…" : "Send"}</button></div>
        </form>
      )}
      <p style={{ ...hintStyle, margin: 0 }}>Sent automatically: the confirmation when someone registers, “a place opened up” from the waiting list, a reminder two days before and on the morning of the day.</p>
    </div>
  );
}

// ---- The page -----------------------------------------------------------------------------------

export default function GeneralEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const { data: event, isLoading, error } = useGeneralEvent(id);
  const { can } = usePermissions();
  const canEdit = can("general-events", "edit");
  const canDelete = can("general-events", "delete");
  const [deleting, setDeleting] = useState(false);
  const cancel = useEventMutation(id, (body) => generalEventsApi.cancel(id, body), "Event cancelled — everyone registered has been emailed");
  const reopen = useEventMutation(id, (body) => generalEventsApi.update(id, body), "Saved");

  if (isLoading) return <p style={{ fontFamily: FONT, color: BRAND.muted }}>Loading…</p>;
  if (error || !event) return <p style={{ fontFamily: FONT, color: BRAND.danger }}>{errorOf(error) || "Event not found"}</p>;

  const askCancel = async () => {
    const reason = await askText({ title: "Cancel this event?", message: `Everyone registered (${plural(event.stats.registrations, "registration")}) is emailed that it's cancelled. This can't be undone.`, label: "Why (shown to them, optional)", tone: "danger", placeholder: "E.g. We've had to move it — new date coming soon" });
    if (reason === null) return;
    cancel.mutate({ reason: reason || null, notify: true });
  };
  const toggleRegistration = () => reopen.mutate({ ...editableBody(event), registrationOpen: !event.registrationOpen });

  return (
    <div className="ge-page">
      <style>{EVENTS_CSS}</style>
      <Link to="/events#general" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 700, color: BRAND.mid, textDecoration: "none" }}><FiArrowLeft size={14} /> Events</Link>
      <header style={{ borderRadius: 20, overflow: "hidden", background: event.coverImage ? `linear-gradient(90deg, rgba(26,53,80,0.94) 0%, rgba(26,53,80,0.75) 55%, rgba(26,53,80,0.35) 100%), center / cover no-repeat url(${event.coverImage})` : HERO_GRADIENT, padding: "24px 26px", color: "#fff", display: "grid", gap: 10 }}>
        <div className="ge-row" style={{ gap: 8 }}>
          <StatePill state={event.state} />
          {!event.registrationOpen && event.state === "upcoming" && <span style={pill("neutral")}>Registration closed</span>}
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>{event.public.kindLabel}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-0.4px", lineHeight: 1.2 }}>{event.title}</h1>
        {event.tagline && <p style={{ margin: 0, fontSize: 14, opacity: 0.85, maxWidth: 680 }}>{event.tagline}</p>}
        <div className="ge-row" style={{ gap: 16, fontSize: 13.5, opacity: 0.92 }}>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><FiCalendar size={14} /> {event.when}</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>{event.format === "online" ? <FiMonitor size={14} /> : <FiMapPin size={14} />} {event.public.where}</span>
          {event.bootcampName && <span>For {event.bootcampName}</span>}
        </div>
        <div className="ge-row" style={{ marginTop: 4 }}>
          {canEdit && event.state !== "cancelled" && <button type="button" style={btn("gold")} onClick={() => navigate(`/events/general/${id}/edit`)}><FiEdit2 size={14} /> Edit</button>}
          {event.websiteUrl && <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" style={btn("ghost")}><FiExternalLink size={14} /> On the website</a>}
          {event.websiteUrl && <button type="button" style={btn("ghost")} onClick={() => copy(event.websiteUrl, "Link copied")}><FiCopy size={14} /> Copy link</button>}
          {canEdit && event.state === "upcoming" && <button type="button" style={btn("ghost")} onClick={toggleRegistration}>{event.registrationOpen ? "Close registration" : "Open registration"}</button>}
          {canEdit && ["upcoming", "draft"].includes(event.state) && event.status === "published" && <button type="button" style={btn("ghost")} onClick={askCancel}><FiXCircle size={14} /> Cancel event</button>}
          {canDelete && <button type="button" style={btn("ghost")} onClick={() => setDeleting(true)}><FiTrash2 size={14} /> Delete</button>}
        </div>
        {event.status === "draft" && <p style={{ margin: 0, fontSize: 13, background: "rgba(255,255,255,0.14)", padding: "8px 12px", borderRadius: 10 }}>A draft — nobody sees it until you publish it (Edit → Publish).</p>}
        {event.status === "cancelled" && <p style={{ margin: 0, fontSize: 13, background: "rgba(255,255,255,0.14)", padding: "8px 12px", borderRadius: 10 }}>Cancelled {shortDate(event.cancelledAt)}{event.cancelReason ? ` — “${event.cancelReason}”` : ""}.</p>}
      </header>

      <PopupSummary event={event} />

      <div className="ge-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" className="ge-tab" aria-selected={tab === t.key} onClick={() => setParams({ tab: t.key }, { replace: true })}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview event={event} />}
      {tab === "registrations" && <Registrations event={event} canEdit={canEdit} />}
      {tab === "checkin" && <CheckIn event={event} canEdit={canEdit} />}
      {tab === "messages" && <Messages event={event} canEdit={canEdit} />}

      <ConfirmDialog
        isOpen={deleting}
        title="Delete this event?"
        message="It goes from the website and the pop-ups. This can't be undone."
        confirmLabel="Delete"
        usageCheck={() => generalEventsApi.checkRemove(id)}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await generalEventsApi.remove(id);
            toast.success("Event deleted");
            navigate("/events#general");
          } catch (err) {
            if (err?.response?.status !== 409) toast.error(errorOf(err));
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

// The event's own fields, to save one change (registration open / closed) with the rest as they are.
function editableBody(e) {
  const keys = ["title", "kind", "tagline", "description", "coverImage", "images", "startDate", "startTime", "endDate", "endTime", "format", "hubId", "venueName", "venueAddress", "mapUrl", "meetingLink", "bootcampId", "capacity", "waitlistOn", "maxPartySize", "registrationOpen", "registrationClosesOn", "askAboutYou", "isPublic", "websitePopup", "systemPopup", "systemAudience", "popupFrom", "popupUntil", "status"];
  return Object.fromEntries(keys.map((k) => [k, e[k] ?? null]).map(([k, v]) => [k, v === null && ["images"].includes(k) ? [] : v]));
}

// Where the event shows right now — the website, its pop-up, the sign-in pop-up.
function PopupSummary({ event }) {
  const groups = event.systemAudience;
  const lines = [
    [event.isPublic, event.isPublic ? (event.websiteUrl ? "On the website" : "On the website once published") : "Not on the website"],
    [event.isPublic && event.websitePopup, event.isPublic && event.websitePopup ? `Website pop-up ${event.popupFrom ? `from ${shortDate(event.popupFrom)}` : "from publishing"} until ${event.popupUntil ? shortDate(event.popupUntil) : "it starts"}` : "No website pop-up"],
    [event.systemPopup, event.systemPopup ? `Sign-in pop-up for ${groups && groups.length ? `${groups.length} group${groups.length === 1 ? "" : "s"}` : "everyone"}` : "No sign-in pop-up"],
  ];
  return (
    <div className="ge-row" style={{ gap: 8 }}>
      {lines.map(([on, text]) => (
        <span key={text} style={{ ...pill(on ? "good" : "neutral"), display: "inline-flex", gap: 5, alignItems: "center" }}>{on ? <FiCheck size={11} /> : <FiX size={11} />} {text}</span>
      ))}
    </div>
  );
}
