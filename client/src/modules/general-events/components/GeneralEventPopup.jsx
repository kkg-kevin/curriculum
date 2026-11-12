import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCalendar, FiCheck, FiClock, FiMapPin, FiMinus, FiMonitor, FiPlus, FiUsers, FiX } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";
import { readSession, writeSession } from "../../../utils/safeStorage";
import { errorOf, myEventsApi } from "../services/generalEventsApi";
import { downloadCalendar, googleCalendarUrl } from "../calendar";

// The sign-in pop-up for general events (server: GET /api/my-events/popup) — mounted in every
// portal, for everyone signed in (the event's audience decides who). It waits until the other
// sign-in pop-ups (hub check-ins, parent–mentor check-ins — marked data-signin-popup) have closed,
// so only one shows at a time. Then: the event, and registering in one go (their name and email
// filled in; phone asked if we don't have it) → the optional "about you" (taps only) → done, with
// "add to calendar". "Not now" hides that event for 3 days. A notification's ?event=<id> opens
// that event whatever. A child's own login sees the event and is asked to tell their parent.
const closedKey = (userId) => `events.popup.closed:${userId}`;
const AGES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const CSS = `
  .gep-backdrop { position: fixed; inset: 0; z-index: 10000; background: rgba(10,22,40,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; font-family: ${FONT}; }
  .gep-card { width: min(520px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; background: #fff; border-radius: 22px; box-shadow: 0 30px 80px rgba(10,22,40,0.35); outline: none; animation: gep-in .22s ease-out; }
  @keyframes gep-in { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
  .gep-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1.5px solid ${BRAND.border}; background: #fff; font: 700 13px ${FONT}; color: ${BRAND.inkSoft}; cursor: pointer; }
  .gep-chip[aria-pressed="true"] { background: ${BRAND.navy}; border-color: ${BRAND.navy}; color: #fff; }
  .gep-age { min-width: 44px; justify-content: center; padding: 0 10px; }
  .gep-input { width: 100%; box-sizing: border-box; min-height: 46px; padding: 10px 12px; border-radius: 12px; border: 1.5px solid ${BRAND.border}; font: 15px ${FONT}; color: ${BRAND.ink}; background: #fff; }
  .gep-input:focus, .gep-chip:focus-visible, .gep-btn:focus-visible { outline: 3px solid ${BRAND.skyBorder}; outline-offset: 1px; }
  .gep-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 20px; border-radius: 14px; font: 800 15px ${FONT}; cursor: pointer; text-decoration: none; box-sizing: border-box; }
  .gep-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) {
    .gep-backdrop { align-items: flex-end; padding: 0; }
    .gep-card { width: 100%; border-radius: 22px 22px 0 0; max-height: 92dvh; animation-name: gep-up; }
    @keyframes gep-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
    .gep-grid { grid-template-columns: 100%; }
    .gep-actions { flex-direction: column-reverse; }
    .gep-actions > * { width: 100%; }
  }
`;

const button = (variant) => ({
  ...(variant === "primary" ? { background: BRAND.navy, color: "#fff", border: `2px solid ${BRAND.navy}` }
    : variant === "gold" ? { background: BRAND.gold, color: "#3d2a00", border: `2px solid ${BRAND.gold}` }
    : { background: "#fff", color: BRAND.navy, border: `2px solid ${BRAND.navyBorder}` }),
});

function Fact({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: BRAND.inkSoft, lineHeight: 1.4 }}>
      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, background: BRAND.skyTint, color: BRAND.mid, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={15} /></span>
      <span style={{ paddingTop: 5, minWidth: 0 }}>{children}</span>
    </div>
  );
}

function Chips({ options, value, onChange, multi = false }) {
  const selected = multi ? value || [] : [value];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {Object.entries(options).map(([key, label]) => {
        const on = selected.includes(key);
        return (
          <button key={key} type="button" className="gep-chip" aria-pressed={on}
            onClick={() => onChange(multi ? (on ? selected.filter((k) => k !== key) : [...selected, key]) : on ? null : key)}>
            {on && multi && <FiCheck size={13} />} {label}
          </button>
        );
      })}
    </div>
  );
}

export default function GeneralEventPopup() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const asked = new URLSearchParams(location.search).get("event");
  const [closed, setClosed] = useState(() => (user ? readSession(closedKey(user.id)) === "1" : false));
  const [othersOpen, setOthersOpen] = useState(true);
  const [step, setStep] = useState("event"); // event | about | done
  const [form, setForm] = useState(null);
  const [about, setAbout] = useState({ personType: null, childrenAges: [], interests: [], heardFrom: null, organisation: "" });
  const [registration, setRegistration] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);

  const enabled = !!user && (!closed || !!asked);
  const { data } = useQuery({
    queryKey: ["my-events", "popup", user?.id, asked || null],
    queryFn: () => myEventsApi.popup(asked),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // One pop-up at a time: wait until no other sign-in pop-up is on screen (checked twice a second,
  // and for a moment after the last one closes).
  useEffect(() => {
    if (!enabled) return undefined;
    let quietSince = null;
    const tick = () => {
      const busyNow = !!document.querySelector("[data-signin-popup]");
      if (busyNow) { quietSince = null; setOthersOpen(true); return; }
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= 1200) setOthersOpen(false);
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [enabled]);

  useEffect(() => {
    if (!data || form) return;
    setForm({ name: data.prefill?.name || "", email: data.prefill?.email || "", phone: data.prefill?.phone || "", partySize: 1, marketingConsent: false });
    if (data.registration) { setRegistration(data.registration); setStep("done"); }
  }, [data, form]);

  const visible = enabled && !!data?.event && !othersOpen && !!form;

  const close = () => {
    writeSession(closedKey(user.id), "1");
    setClosed(true);
    if (asked) {
      const params = new URLSearchParams(location.search);
      params.delete("event");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : "" }, { replace: true });
    }
  };
  const notNow = async () => {
    if (data?.event && !registration) myEventsApi.hide(data.event.id, 3).catch(() => {});
    close();
  };

  useEffect(() => {
    if (!visible) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") notNow(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;
  const { event } = data;
  const reg = event.registration;
  const child = !data.canRegister;
  const firstName = String(user.name || "").trim().split(/\s+/)[0];
  const max = reg.maxPartySize || 5;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.phone.trim()) return setError("Add your phone number");
    if (!form.email.trim()) return setError("Add your email address");
    setBusy(true);
    try {
      const result = await myEventsApi.register(event.id, {
        name: form.name.trim() || undefined, email: form.email.trim(), phone: form.phone.trim(),
        partySize: form.partySize, marketingConsent: form.marketingConsent, fromPopup: true,
      });
      if (result.already) {
        toast.success("That email is already registered — we've emailed the details again.");
        close();
        return;
      }
      setRegistration(result.registration);
      qc.invalidateQueries({ queryKey: ["my-events"] });
      setStep(event.askAboutYou ? "about" : "done");
    } catch (err) {
      setError(errorOf(err));
    } finally {
      setBusy(false);
    }
  };
  const saveAbout = async () => {
    setBusy(true);
    try {
      await myEventsApi.details(registration.id, { ...about, organisation: about.organisation || null });
    } catch { /* optional — never blocks */ }
    setBusy(false);
    setStep("done");
  };

  const waiting = registration?.status === "waitlisted";
  const heroTitle = step === "done" ? (waiting ? "You're on the waiting list" : "You're in!") : step === "about" ? "One more thing (optional)" : event.title;

  return createPortal(
    <div className="gep-backdrop" role="presentation" data-event-popup="" onMouseDown={(e) => { if (e.target === e.currentTarget) notNow(); }}>
      <style>{CSS}</style>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="gep-title" className="gep-card">
        <div style={{ position: "relative", padding: "22px 22px 18px", color: "#fff", background: event.coverImage ? `linear-gradient(180deg, rgba(26,53,80,0.35) 0%, rgba(26,53,80,0.92) 100%), center / cover no-repeat url(${event.coverImage})` : HERO_GRADIENT, minHeight: step === "event" ? 150 : 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6 }}>
          <button type="button" onClick={notNow} aria-label="Close" style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FiX size={18} /></button>
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: BRAND.gold }}>
            {step === "event" ? `${firstName ? `${firstName}, you're invited` : "You're invited"} · ${event.kindLabel}` : event.title}
          </span>
          <h2 id="gep-title" style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>{heroTitle}</h2>
          {step === "event" && event.tagline && <p style={{ margin: 0, fontSize: 14, opacity: 0.9, lineHeight: 1.45 }}>{event.tagline}</p>}
        </div>

        <div style={{ padding: "18px 22px 22px", display: "grid", gap: 16 }}>
          {step === "event" && (
            <>
              <div style={{ display: "grid", gap: 10 }}>
                <Fact icon={FiCalendar}>{event.when}</Fact>
                <Fact icon={event.format === "online" ? FiMonitor : FiMapPin}>{event.where}</Fact>
                <Fact icon={FiUsers}>Free{reg.seatsLeft != null ? ` · only ${reg.seatsLeft} ${reg.seatsLeft === 1 ? "place" : "places"} left` : ""}{reg.full && reg.waitlist ? " · full — join the waiting list" : ""}</Fact>
              </div>

              {child ? (
                <>
                  <p style={{ margin: 0, padding: "12px 14px", borderRadius: 12, background: BRAND.goldTint, color: BRAND.goldText, fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>Want to go? Ask your parent to register — they&rsquo;ll see this when they sign in.</p>
                  <div className="gep-actions" style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" className="gep-btn" style={button("primary")} onClick={notNow}>OK</button>
                  </div>
                </>
              ) : !reg.open ? (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: BRAND.muted }}>{reg.reason}</p>
                  <div className="gep-actions" style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="gep-btn" style={button()} onClick={close}>Close</button></div>
                </>
              ) : (
                <form onSubmit={submit} style={{ display: "grid", gap: 12 }} noValidate>
                  {(!data.prefill?.name) && (
                    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>Your name
                      <input className="gep-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required />
                    </label>
                  )}
                  <div className="gep-grid">
                    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>Phone (WhatsApp)
                      <input className="gep-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="07…" required />
                    </label>
                    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>Email
                      <input className="gep-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required />
                    </label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>How many of you are coming?</span>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <button type="button" className="gep-chip gep-age" aria-label="Fewer" onClick={() => setForm({ ...form, partySize: Math.max(1, form.partySize - 1) })} disabled={form.partySize <= 1}><FiMinus size={14} /></button>
                      <span aria-live="polite" style={{ minWidth: 34, textAlign: "center", fontSize: 18, fontWeight: 900, color: BRAND.ink }}>{form.partySize}</span>
                      <button type="button" className="gep-chip gep-age" aria-label="More" onClick={() => setForm({ ...form, partySize: Math.min(max, form.partySize + 1) })} disabled={form.partySize >= max}><FiPlus size={14} /></button>
                    </div>
                  </div>
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: BRAND.inkSoft, lineHeight: 1.45, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} style={{ width: 18, height: 18, marginTop: 1, accentColor: BRAND.navy, flexShrink: 0 }} />
                    Keep me posted about Digifunzi programmes and events
                  </label>
                  {error && <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: BRAND.danger }}>{error}</p>}
                  <div className="gep-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button type="button" className="gep-btn" style={button()} onClick={notNow}>Not now</button>
                    <button type="submit" className="gep-btn" style={button("gold")} disabled={busy}>
                      {busy ? "Saving…" : reg.full && reg.waitlist ? "Join the waiting list" : form.partySize > 1 ? `Reserve ${form.partySize} places` : "Reserve my place"}
                    </button>
                  </div>
                  {data.others > 0 && data.websiteUrl && (
                    <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.mid, textAlign: "center" }}>See {data.others} more {data.others === 1 ? "event" : "events"}</a>
                  )}
                </form>
              )}
            </>
          )}

          {step === "about" && (
            <>
              <p style={{ margin: 0, fontSize: 14, color: BRAND.inkSoft, lineHeight: 1.5 }}>Your place is saved. A few taps help us make it great for you — or skip.</p>
              <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13.5, color: BRAND.ink }}>I am…</strong><Chips options={event.questions.personTypes} value={about.personType} onChange={(v) => setAbout({ ...about, personType: v })} /></div>
              {about.personType === "school" && <input className="gep-input" placeholder="Which school?" value={about.organisation} onChange={(e) => setAbout({ ...about, organisation: e.target.value })} />}
              {about.personType !== "school" && about.personType !== "student" && (
                <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13.5, color: BRAND.ink }}>Children&rsquo;s ages <span style={{ fontWeight: 500, color: BRAND.muted }}>(tap each)</span></strong>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {AGES.map((a) => {
                      const on = about.childrenAges.includes(a);
                      return <button key={a} type="button" className="gep-chip gep-age" aria-pressed={on} onClick={() => setAbout({ ...about, childrenAges: on ? about.childrenAges.filter((x) => x !== a) : [...about.childrenAges, a] })}>{a}</button>;
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13.5, color: BRAND.ink }}>Interested in</strong><Chips multi options={event.questions.interests} value={about.interests} onChange={(v) => setAbout({ ...about, interests: v })} /></div>
              <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13.5, color: BRAND.ink }}>How did you hear about it?</strong><Chips options={event.questions.heardFrom} value={about.heardFrom} onChange={(v) => setAbout({ ...about, heardFrom: v })} /></div>
              <div className="gep-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="gep-btn" style={button()} onClick={() => setStep("done")}>Skip</button>
                <button type="button" className="gep-btn" style={button("primary")} onClick={saveAbout} disabled={busy}>{busy ? "Saving…" : "Done"}</button>
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", background: waiting ? BRAND.goldTint : BRAND.skyTint, color: waiting ? BRAND.goldText : BRAND.mid, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{waiting ? <FiClock size={20} /> : <FiCheck size={22} />}</span>
                <p style={{ margin: 0, fontSize: 14.5, color: BRAND.inkSoft, lineHeight: 1.55 }}>
                  {waiting
                    ? "It's full right now. If a place frees up it's yours in turn — we'll email you straight away."
                    : `We've kept ${registration?.partySize > 1 ? `${registration.partySize} places` : "a place"} for you at ${event.title}. Your ticket is in your email — show its QR code at the entrance. We'll remind you before the day.`}
                </p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <Fact icon={FiCalendar}>{event.when}</Fact>
                <Fact icon={event.format === "online" ? FiMonitor : FiMapPin}>{event.where}</Fact>
              </div>
              <div className="gep-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                {!waiting && <a className="gep-btn" style={button()} href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">Google Calendar</a>}
                {!waiting && <button type="button" className="gep-btn" style={button()} onClick={() => downloadCalendar(event)}>Add to calendar</button>}
                <button type="button" className="gep-btn" style={button("primary")} onClick={close}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
