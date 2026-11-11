import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiClock, FiInfo, FiMapPin, FiStar, FiVideo } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { useMentorDirectory } from "../../educator-profiles/hooks/useEducatorProfile";
import { useBook, useBookingOptions, useFreeTimes, errorText } from "../hooks/useMentorBookings";
import { dayLabel, ksh, lengthLabel } from "../shared";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading } from "../../../theme/brand";

// Book a mentor (parent portal, /parent/bookings/new). One page, step by step — each step opens
// once the one before it is chosen:
//   1. which child   2. which mentor (any published mentor of the child's learning centres)
//   3. what they're stuck on (an open help request from the child, or a course and session)
//   4. how long      5. where — online, or a hub's space (its fee is added)   6. a free time
// then the price and "Book and pay": the time is held while the invoice is paid (pay first).
// ?learnerId= &teacherId= &help= open it on a child, a mentor (from their profile) or a request.

const box = { ...card, padding: "18px 20px", fontFamily: FONT };
const label = { display: "block", fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, marginBottom: 6 };
const control = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
const chip = (on, disabled = false) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 11, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 });

function Step({ n, title, note, done, children }) {
  return (
    <section style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 900, background: done ? BRAND.mid : BRAND.skyTint, color: done ? "#fff" : BRAND.navy, flexShrink: 0 }}>{done ? <FiCheck size={14} /> : n}</span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{title}</h2>
          {note && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: BRAND.muted }}>{note}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const spacePrice = (s, minutes) => {
  if (s.pricingModel === "free" || !s.rate) return 0;
  if (s.pricingModel === "hourly") return Math.round(s.rate * (minutes / 60) * 100) / 100;
  return s.rate;
};

export default function BookMentorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { children = [] } = useOutletContext() || {};
  const { data: mentors = [], isLoading: mentorsLoading } = useMentorDirectory();

  const [learnerId, setLearnerId] = useState(params.get("learnerId") || "");
  const [teacherId, setTeacherId] = useState(params.get("teacherId") || "");
  const [helpId, setHelpId] = useState(params.get("help") || "");
  const [courseId, setCourseId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(null);
  const [mode, setMode] = useState("online");
  const [hubId, setHubId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState(null);

  useEffect(() => { if (!learnerId && children.length === 1) setLearnerId(children[0].id); }, [children, learnerId]);
  // A mentor passed by id (?teacherId=) or by their profile's slug.
  const mentor = mentors.find((m) => m.teacherId === teacherId) || null;

  const { data: options, isLoading: optionsLoading, error: optionsError } = useBookingOptions(learnerId, teacherId);
  const helpRequests = options?.helpRequests || [];
  const help = helpRequests.find((h) => h.id === helpId) || null;
  // A chosen help request fills in what they're stuck on.
  useEffect(() => {
    if (help) { setCourseId(help.courseId || ""); setSessionId(help.sessionId || ""); setTopic(help.message || ""); }
  }, [help]);
  useEffect(() => { if (options?.lengths?.length && !minutes) setMinutes(options.lengths[options.lengths.length > 1 ? 1 : 0].minutes); }, [options, minutes]);
  // A change of mentor, length or place clears the time.
  useEffect(() => { setDay(""); setSlot(null); }, [teacherId, learnerId, minutes, mode, hubId, spaceId]);

  const course = options?.courses?.find((c) => c.id === courseId) || null;
  const hub = options?.hubs?.find((h) => h.id === hubId) || null;
  const space = hub?.spaces.find((s) => s.id === spaceId) || null;
  const placeChosen = mode === "online" || (hub && space);
  const { data: times, isFetching: timesLoading, error: timesError } = useFreeTimes(
    { learnerId, teacherId, minutes, ...(mode === "hub" && hub && space ? { hubId, spaceId } : {}) },
    { enabled: !!options?.enabled && !!minutes && !!placeChosen },
  );
  const byDay = useMemo(() => {
    const map = new Map();
    for (const s of times?.slots || []) (map.get(s.date) || map.set(s.date, []).get(s.date)).push(s);
    return map;
  }, [times]);
  useEffect(() => { if (!day && byDay.size) setDay([...byDay.keys()][0]); }, [byDay, day]);

  const length = options?.lengths?.find((l) => l.minutes === minutes) || null;
  const included = !!options?.allowance && options.allowance.left > 0;
  const mentorFee = length ? (included ? 0 : length.price) : 0;
  const deskFee = mode === "hub" && space && !hub?.hasDesk ? spacePrice(space, minutes || 0) : 0;
  const total = mentorFee + deskFee;
  const book = useBook();
  const ready = learnerId && teacherId && length && placeChosen && slot && (courseId || topic.trim());

  const submit = () => {
    if (!ready) return;
    book.mutate({
      learnerId, teacherId, minutes, date: slot.date, startTime: slot.startTime, mode,
      hubId: mode === "hub" ? hubId : null, spaceId: mode === "hub" ? spaceId : null,
      courseId: courseId || null, sessionId: sessionId || null, topic: topic.trim(), helpRequestId: helpId || null,
    }, {
      onSuccess: (r) => navigate(r.invoiceId ? `/parent/invoices/${r.invoiceId}` : `/parent/bookings/${r.booking.id}`),
    });
  };

  const child = children.find((c) => c.id === learnerId);

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
      <button type="button" onClick={() => navigate("/parent/bookings")} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}><FiArrowLeft /> Mentor sessions</button>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "22px 26px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Book a mentor</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 620, lineHeight: 1.6 }}>Stuck on a session? A mentor takes your child through it, online or at a hub. Pay to confirm the time.</p>
      </div>

      <Step n={1} title="Who is it for?" done={!!learnerId}>
        {children.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>No children on your account yet.</p> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {children.map((c) => <button key={c.id} type="button" onClick={() => { setLearnerId(c.id); setHelpId(""); }} style={chip(learnerId === c.id)}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</button>)}
          </div>
        )}
      </Step>

      {learnerId && (
        <Step n={2} title="Choose a mentor" note="Published mentors at your children's learning centres." done={!!teacherId}>
          {mentorsLoading ? <p style={{ margin: 0, color: BRAND.faint, fontSize: 13 }}>Loading…</p> : mentors.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>No mentor has published their profile yet.</p> : (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))" }}>
              {mentors.map((m) => {
                const [first, ...rest] = m.name.split(" ");
                const on = teacherId === m.teacherId;
                return (
                  <button key={m.teacherId} type="button" onClick={() => setTeacherId(m.teacherId)} style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left", padding: "11px 12px", borderRadius: 13, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.skyTint : "#fff", cursor: "pointer", fontFamily: FONT, minWidth: 0 }}>
                    <Avatar firstName={first} lastName={rest.join(" ")} photo={m.photo} size={40} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{m.name}</span>
                      <span style={{ display: "flex", gap: 8, fontSize: 12, color: BRAND.muted }}>
                        {m.rating?.isNew ? "New" : <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FiStar size={11} color={BRAND.gold} /> {m.rating.average.toFixed(1)}</span>}
                        <span>{m.hours} h taught</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {teacherId && !mentor && !mentorsLoading && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: BRAND.danger }}>That mentor isn't listed for your children.</p>}
        </Step>
      )}

      {learnerId && teacherId && (optionsLoading ? <div style={{ ...box, color: BRAND.faint, fontSize: 13 }}>Loading…</div>
        : optionsError ? <div style={{ ...box, color: BRAND.danger, fontSize: 13.5 }}>{errorText(optionsError)}</div>
          : options && !options.enabled ? <div style={{ ...box, color: BRAND.inkSoft, fontSize: 13.5 }}>Booking a mentor isn&apos;t open at this learning centre yet. Ask the team, or check back soon.</div>
            : options && (
              <>
                {!options.hasAvailability && <div style={{ ...box, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 13.5 }}>{options.mentor.name} hasn&apos;t shared when they&apos;re free yet, so there are no times to book. Choose another mentor, or check back soon.</div>}

                <Step n={3} title={`What is ${child?.firstName || "your child"} stuck on?`} done={!!(courseId || topic.trim())}>
                  {helpRequests.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={label}>{child?.firstName || "Your child"} asked for help with</span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {helpRequests.map((h) => <button key={h.id} type="button" onClick={() => setHelpId(helpId === h.id ? "" : h.id)} style={chip(helpId === h.id)}>{h.sessionTitle || h.courseName || "A session"}</button>)}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
                    <div>
                      <label htmlFor="bk-course" style={label}>Course</label>
                      <select id="bk-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setSessionId(""); }} style={control}>
                        <option value="">{options.courses.length ? "Choose a course…" : "No courses yet"}</option>
                        {options.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="bk-session" style={label}>Session <span style={{ fontWeight: 500, color: BRAND.faint }}>(optional)</span></label>
                      <select id="bk-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={!course} style={{ ...control, opacity: course ? 1 : 0.6 }}>
                        <option value="">Any session</option>
                        {(course?.sessions || []).map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>)}
                      </select>
                    </div>
                  </div>
                  <label htmlFor="bk-topic" style={{ ...label, marginTop: 12 }}>What should the mentor know? <span style={{ fontWeight: 500, color: BRAND.faint }}>(optional)</span></label>
                  <textarea id="bk-topic" value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} maxLength={1000} placeholder="e.g. She doesn't understand loops in Scratch." style={{ ...control, resize: "vertical" }} />
                </Step>

                <Step n={4} title="How long?" done={!!length}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {options.lengths.map((l) => (
                      <button key={l.minutes} type="button" onClick={() => setMinutes(l.minutes)} style={chip(minutes === l.minutes)}>
                        <FiClock size={13} /> {lengthLabel(l.minutes)} · {included ? <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{ksh(l.price)}</span> : ksh(l.price)}
                      </button>
                    ))}
                  </div>
                  {included && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: BRAND.navy, display: "flex", alignItems: "center", gap: 6 }}><FiCheck /> Included in {options.allowance.pathwayName} — {options.allowance.left} of {options.allowance.included} left this period.</p>}
                </Step>

                <Step n={5} title="Where?" done={placeChosen}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setMode("online")} style={chip(mode === "online")}><FiVideo size={13} /> Online</button>
                    <button type="button" onClick={() => setMode("hub")} disabled={!options.hubs.length} style={chip(mode === "hub", !options.hubs.length)}><FiMapPin size={13} /> At a hub</button>
                  </div>
                  {!options.hubs.length && <p style={{ margin: "8px 0 0", fontSize: 12, color: BRAND.faint }}>No hub has a space open for booking yet.</p>}
                  {mode === "hub" && (
                    <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
                      <div>
                        <label htmlFor="bk-hub" style={label}>Hub</label>
                        <select id="bk-hub" value={hubId} onChange={(e) => { setHubId(e.target.value); setSpaceId(""); }} style={control}>
                          <option value="">Choose a hub…</option>
                          {options.hubs.map((h) => <option key={h.id} value={h.id}>{h.name}{h.town ? ` · ${h.town}` : ""}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="bk-space" style={label}>Space</label>
                        <select id="bk-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} disabled={!hub} style={{ ...control, opacity: hub ? 1 : 0.6 }}>
                          <option value="">Choose a space…</option>
                          {(hub?.spaces || []).map((s) => <option key={s.id} value={s.id}>{s.name} — {s.pricingModel === "free" || !s.rate ? "free" : `${ksh(s.rate)} ${s.priceUnit || ""}`.trim()}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {mode === "hub" && hub?.hasDesk && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: BRAND.navy }}>{child?.firstName || "Your child"} already has a desk at {hub.name}, so there&apos;s no space fee.</p>}
                </Step>

                {length && placeChosen && (
                  <Step n={6} title="When?" note={`Times are at least ${options.noticeHours} hours away.`} done={!!slot}>
                    {timesLoading ? <p style={{ margin: 0, fontSize: 13, color: BRAND.faint }}>Finding free times…</p>
                      : timesError ? <p style={{ margin: 0, fontSize: 13, color: BRAND.danger }}>{errorText(timesError)}</p>
                        : !byDay.size ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>No free times in the next few weeks{mode === "hub" ? " at this space" : ""}. Try another length{mode === "hub" ? ", space" : ""} or mentor.</p> : (
                          <>
                            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                              {[...byDay.keys()].map((d) => <button key={d} type="button" onClick={() => { setDay(d); setSlot(null); }} style={{ ...chip(day === d), flexShrink: 0, flexDirection: "column", gap: 0, padding: "8px 12px" }}><span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{dayLabel(d, { weekday: "short" })}</span><span>{dayLabel(d, { day: "numeric", month: "short" })}</span></button>)}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                              {(byDay.get(day) || []).map((s) => <button key={s.key} type="button" onClick={() => setSlot(s)} style={chip(slot?.key === s.key)}>{s.startTime}–{s.endTime}</button>)}
                            </div>
                          </>
                        )}
                  </Step>
                )}

                {slot && length && (
                  <section style={{ ...box, border: `1.5px solid ${BRAND.skyBorder}` }}>
                    <h2 style={{ ...cardHeading, marginBottom: 10 }}>Your booking</h2>
                    <p style={{ margin: "0 0 12px", fontSize: 14, color: BRAND.ink, lineHeight: 1.6 }}>
                      <strong>{options.mentor.name}</strong> with <strong>{child?.firstName}</strong>, {dayLabel(slot.date, { weekday: "long", day: "numeric", month: "long" })}, {slot.startTime}–{slot.endTime}, {mode === "online" ? "online" : `at ${hub.name} (${space.name})`}.
                    </p>
                    <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%", fontSize: 13.5, maxWidth: 420 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>Mentor session · {lengthLabel(minutes)}</span><span>{included ? "Included" : ksh(mentorFee)}</span></div>
                      {mode === "hub" && <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{space.name} at {hub.name}</span><span>{deskFee ? ksh(deskFee) : "No charge"}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 8, borderTop: `1px solid ${BRAND.line}`, fontWeight: 900, fontSize: 15 }}><span>To pay</span><span>{ksh(total)}</span></div>
                    </div>
                    <p style={{ margin: "12px 0 0", fontSize: 12.5, color: BRAND.muted, display: "flex", gap: 6, lineHeight: 1.5 }}>
                      <FiInfo size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      {total > 0 ? `We hold this time for ${options.holdMinutes >= 60 ? `${Math.round(options.holdMinutes / 60)} hour${options.holdMinutes >= 120 ? "s" : ""}` : `${options.holdMinutes} minutes`} while you pay — once paid, it's booked. ` : "Nothing to pay — it's booked straight away. "}
                      You can cancel up to {options.cancelHours} hours before for your money back.
                    </p>
                    <button type="button" onClick={submit} disabled={!ready || book.isPending} style={{ marginTop: 14, padding: "11px 20px", borderRadius: 11, border: "none", background: BRAND.gold, color: BRAND.navy, fontSize: 14, fontWeight: 800, cursor: ready && !book.isPending ? "pointer" : "not-allowed", fontFamily: FONT, opacity: ready ? 1 : 0.6 }}>
                      {book.isPending ? "Booking…" : total > 0 ? `Book and pay ${ksh(total)}` : "Book"}
                    </button>
                    {!courseId && !topic.trim() && <p style={{ margin: "8px 0 0", fontSize: 12, color: BRAND.goldText }}>Say what they&apos;re stuck on (step 3) first.</p>}
                  </section>
                )}
              </>
            ))}
    </div>
  );
}
