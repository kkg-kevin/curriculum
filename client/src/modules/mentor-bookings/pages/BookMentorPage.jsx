import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiCheck, FiClock, FiInfo, FiMapPin, FiStar, FiVideo, FiSun, FiSunrise, FiMoon, FiUser, FiBookOpen, FiCalendar, FiAlertCircle, FiDollarSign } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { useMentorDirectory } from "../../educator-profiles/hooks/useEducatorProfile";
import { useBook, useBookingOptions, useFreeTimes, errorText } from "../hooks/useMentorBookings";
import { dayLabel, ksh, lengthLabel } from "../shared";
import { BRAND, FONT, HERO_GRADIENT, card } from "../../../theme/brand";

// Book a mentor (parent portal, /parent/bookings/new) — redesigned 24 Nov 2026 to use the whole
// screen. Six steps, each opening once the one before it is chosen:
//   1. which child   2. which mentor (any published mentor of the child's learning centres)
//   3. what they're stuck on (a help request from the child, or a course and session)
//   4. how long      5. where — online, or a hub's space (its fee is added)   6. a free time
// "Your booking" fills in as they choose: beside the steps on a laptop (it stays in view), under
// them on smaller screens, with a bar fixed to the bottom of a phone (the total, and the next
// step or Book). The time is held while the invoice is paid (pay first).
// ?learnerId= &teacherId= &help= open it on a child, a mentor (from their profile) or a request.
//
// Family credits (27 Nov 2026): a parent may pay with their credits (what the wallet covers; the
// invoice holds the rest). A child's own login (/learner-portal/bookings/new) books for THEMSELF
// with the family's credits — no "who" step, worded to them, booked at once when there are enough
// credits and their parent lets them; otherwise it says to ask their parent.

const credit = (n) => `${Number(n || 0).toLocaleString("en-KE")} credits`;

// Can a child pay this from the family's credits? { ok, reason }
function childCanPay(credits, total) {
  if (!credits) return { ok: false, reason: null };
  if (!credits.enabled) return { ok: false, reason: "Booking a mentor yourself isn't on at your learning centre yet. Ask your parent to book for you." };
  if (!credits.hasParentLogin) return { ok: false, reason: "Your parent needs a Digifunzi login before you can book. Ask them." };
  if (!credits.allowed) return { ok: false, reason: "Your parent hasn't switched on booking with credits for you. Ask them to book, or to switch it on." };
  if (total > 0 && credits.left != null && total > credits.left) return { ok: false, reason: `That's more than you can spend this month (${credit(credits.left)} left). Ask your parent.` };
  if (total > credits.balance) return { ok: false, reason: `You need ${credit(total)} and your family has ${credit(credits.balance)}. Ask your parent to add some.` };
  return { ok: true, reason: null };
}

const label = { display: "block", fontSize: 13, fontWeight: 700, color: BRAND.inkSoft, marginBottom: 6 };
const control = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${BRAND.border}`, fontSize: 15, fontFamily: FONT, color: BRAND.ink, background: "#fff", minHeight: 46 };

// A choice shown as a card you tap; chosen = navy border, sky fill, a tick in the corner.
const option = (on, disabled = false) => ({
  position: "relative", display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%", boxSizing: "border-box",
  padding: "14px 16px", borderRadius: 14, border: `2px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.skyTint : "#fff",
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: FONT, color: BRAND.ink, minHeight: 56,
  transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease",
});
const Tick = ({ on }) => (on ? <span aria-hidden style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 999, background: BRAND.navy, color: "#fff", display: "grid", placeItems: "center" }}><FiCheck size={13} /></span> : null);

function useWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

const scrollToStep = (n) => document.getElementById(`bk-step-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

function Step({ n, title, note, done, summary, children }) {
  return (
    <section id={`bk-step-${n}`} style={{ ...card, padding: "20px 22px", fontFamily: FONT, scrollMarginTop: 16, borderColor: done ? BRAND.skyBorder : BRAND.border }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900, background: done ? BRAND.mid : BRAND.skyTint, color: done ? "#fff" : BRAND.navy, flexShrink: 0 }}>{done ? <FiCheck size={16} /> : n}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: BRAND.ink }}>{title}</h2>
          {note && <p style={{ margin: "2px 0 0", fontSize: 13, color: BRAND.muted }}>{note}</p>}
        </div>
        {summary && <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.mid, textAlign: "right", maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>}
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

const partOfDay = (time) => {
  const h = Number(String(time).slice(0, 2));
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
};
const PARTS = [
  { key: "morning", label: "Morning", Icon: FiSunrise },
  { key: "afternoon", label: "Afternoon", Icon: FiSun },
  { key: "evening", label: "Evening", Icon: FiMoon },
];
const WEEKDAYS = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

export default function BookMentorPage() {
  const navigate = useNavigate();
  const forChild = useLocation().pathname.startsWith("/learner-portal");
  const base = forChild ? "/learner-portal/bookings" : "/parent/bookings";
  const [params] = useSearchParams();
  const width = useWidth();
  const wide = width >= 1100; // "Your booking" beside the steps
  const phone = width < 900; // a bar fixed to the bottom of the screen
  const outlet = useOutletContext() || {};
  const children = forChild ? (outlet.learner ? [outlet.learner] : []) : (outlet.children || []);
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
  const [useCredits, setUseCredits] = useState(false);

  useEffect(() => { if (!learnerId && children.length === 1) setLearnerId(children[0].id); }, [children, learnerId]);
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
  const session = course?.sessions?.find((s) => s.id === sessionId) || null;
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
  const about = !!(courseId || topic.trim());
  const credits = options?.credits || null;
  // A parent's credits cover what they can; a child pays it all in credits.
  const creditsApplied = forChild ? total : useCredits && credits?.enabled ? Math.min(total, credits.balance || 0) : 0;
  const childPay = forChild ? childCanPay(credits, total) : { ok: true };
  const ready = learnerId && teacherId && length && placeChosen && slot && about && (!forChild || total === 0 || childPay.ok);

  const submit = () => {
    if (!ready) return;
    book.mutate({
      learnerId, teacherId, minutes, date: slot.date, startTime: slot.startTime, mode,
      hubId: mode === "hub" ? hubId : null, spaceId: mode === "hub" ? spaceId : null,
      courseId: courseId || null, sessionId: sessionId || null, topic: topic.trim(), helpRequestId: helpId || null,
      useCredits: forChild || (useCredits && creditsApplied > 0),
    }, {
      onSuccess: (r) => navigate(!forChild && r.invoiceId ? `/parent/invoices/${r.invoiceId}` : `${base}/${r.booking.id}`),
    });
  };

  const child = children.find((c) => c.id === learnerId);
  const childName = forChild ? "you" : child?.firstName || "your child";
  const open = !!(learnerId && teacherId && options?.enabled);

  // The steps, for the progress strip, the summary and "Next".
  const steps = [
    { n: 1, short: forChild ? "You" : "Child", done: !!learnerId, value: child ? [child.firstName, child.lastName].filter(Boolean).join(" ") : null, Icon: FiUser },
    { n: 2, short: "Mentor", done: !!teacherId && !!mentor, value: mentor?.name || null, Icon: FiStar },
    { n: 3, short: "Help with", done: about, value: session?.title || course?.name || (topic.trim() ? "Described" : null), Icon: FiBookOpen },
    { n: 4, short: "Length", done: !!length, value: length ? lengthLabel(length.minutes) : null, Icon: FiClock },
    { n: 5, short: "Place", done: !!placeChosen && open, value: mode === "online" ? "Online" : hub && space ? `${hub.name} · ${space.name}` : null, Icon: mode === "online" ? FiVideo : FiMapPin },
    { n: 6, short: "Time", done: !!slot, value: slot ? `${dayLabel(slot.date, { weekday: "short", day: "numeric", month: "short" })}, ${slot.startTime}` : null, Icon: FiCalendar },
  ];
  const nextStep = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  const summary = (
    <Summary steps={steps} total={total} mentorFee={mentorFee} deskFee={deskFee} included={included} length={length} mode={mode} hub={hub} space={space}
      options={options} ready={ready} book={book} submit={submit} nextStep={nextStep} childName={childName}
      forChild={forChild} credits={credits} creditsApplied={creditsApplied} useCredits={useCredits} setUseCredits={setUseCredits} childPay={childPay} />
  );

  return (
    <div className="bk" style={{ fontFamily: FONT, width: "100%", display: "grid", gap: 16, paddingBottom: phone ? 96 : 0 }}>
      {/* Grid items may shrink below their content, so the row of days scrolls instead of widening
          the page; and a clear focus ring on every choice. */}
      <style>{`.bk [style*="display: grid"] > * { min-width: 0; } .bk button:focus-visible, .bk a:focus-visible { outline: 3px solid ${BRAND.sky}; outline-offset: 2px; } .bk-row { scrollbar-width: thin; }`}</style>
      <button type="button" onClick={() => navigate(base)} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", minHeight: 40, borderRadius: 999, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}><FiArrowLeft /> Mentor sessions</button>

      <header style={{ background: HERO_GRADIENT, borderRadius: 20, padding: phone ? "18px 18px" : "24px 28px", color: "#fff", display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: phone ? 22 : 26, fontWeight: 900 }}>Book a mentor</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{forChild
            ? "Stuck on a session? Book a mentor to take you through it, online or at a hub. It's paid with your family's credits."
            : "Stuck on a session? A mentor takes your child through it, online or at a hub. Pay to confirm the time, or use your credits."}</p>
          {forChild && credits && <p style={{ margin: "10px 0 0", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.16)", fontSize: 13.5, fontWeight: 800 }}><FiDollarSign size={14} /> Your family has {credit(credits.balance)}{credits.left != null ? ` · ${credit(credits.left)} left for you this month` : ""}</p>}
        </div>
        {/* Where they are in the six steps — tap a done one to go back to it. */}
        <ol aria-label="Steps" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: `repeat(${phone ? 3 : 6}, minmax(0, 1fr))`, gap: 8 }}>
          {steps.map((s) => {
            const current = nextStep?.n === s.n;
            return (
              <li key={s.n}>
                <button type="button" onClick={() => scrollToStep(s.n)} aria-current={current ? "step" : undefined}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: `1.5px solid ${current ? BRAND.gold : "rgba(255,255,255,0.28)"}`, background: s.done ? "rgba(255,255,255,0.18)" : current ? "rgba(254,177,57,0.16)" : "transparent", color: "#fff", fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 40 }}>
                  <span aria-hidden style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 900, background: s.done ? "#fff" : "transparent", color: s.done ? BRAND.navy : "#fff", border: s.done ? "none" : "1.5px solid rgba(255,255,255,0.6)" }}>{s.done ? <FiCheck size={13} /> : s.n}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1fr) 380px" : "100%", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          {!forChild && <Step n={1} title="Who is it for?" done={!!learnerId} summary={steps[0].value}>
            {children.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: BRAND.muted }}>No children on your account yet.</p> : (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))" }}>
                {children.map((c) => {
                  const on = learnerId === c.id;
                  return (
                    <button key={c.id} type="button" aria-pressed={on} onClick={() => { setLearnerId(c.id); setHelpId(""); }} style={option(on)}>
                      <Avatar firstName={c.firstName} lastName={c.lastName} photo={c.photo} size={42} />
                      <span style={{ fontSize: 15, fontWeight: 800, minWidth: 0 }}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</span>
                      <Tick on={on} />
                    </button>
                  );
                })}
              </div>
            )}
          </Step>}

          {learnerId && (
            <Step n={2} title="Choose a mentor" note={forChild ? "Mentors at your learning centre." : "Published mentors at your children's learning centres."} done={!!teacherId && !!mentor} summary={steps[1].value}>
              {mentorsLoading ? <p style={{ margin: 0, color: BRAND.faint, fontSize: 14 }}>Loading mentors…</p> : mentors.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: BRAND.muted }}>No mentor has published their profile yet.</p> : (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
                  {mentors.map((m) => <MentorCard key={m.teacherId} m={m} on={teacherId === m.teacherId} onPick={() => setTeacherId(m.teacherId)} forChild={forChild} />)}
                </div>
              )}
              {teacherId && !mentor && !mentorsLoading && <p style={{ margin: "10px 0 0", fontSize: 13, color: BRAND.danger }}>That mentor isn&apos;t listed for your children.</p>}
            </Step>
          )}

          {learnerId && teacherId && (optionsLoading ? <div style={{ ...card, padding: 20, color: BRAND.faint, fontSize: 14 }}>Loading what {mentor?.name?.split(" ")[0] || "this mentor"} offers…</div>
            : optionsError ? <Notice tone="danger">{errorText(optionsError)}</Notice>
              : options && !options.enabled ? <Notice>Booking a mentor isn&apos;t open at this learning centre yet. {forChild ? "Ask your parent." : "Ask the team, or check back soon."}</Notice>
                : options && (
                  <>
                    {!options.hasAvailability && <Notice tone="gold">{options.mentor.name} hasn&apos;t shared when they&apos;re free yet, so there are no times to book. Choose another mentor, or check back soon.</Notice>}

                    <Step n={3} title={forChild ? "What are you stuck on?" : `What is ${childName} stuck on?`} done={about} summary={steps[2].value}>
                      {helpRequests.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <span style={label}>{forChild ? "You asked for help with" : `${child?.firstName || "Your child"} asked for help with`}</span>
                          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
                            {helpRequests.map((h) => {
                              const on = helpId === h.id;
                              return (
                                <button key={h.id} type="button" aria-pressed={on} onClick={() => setHelpId(on ? "" : h.id)} style={{ ...option(on), alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
                                  <span style={{ fontSize: 14.5, fontWeight: 800, paddingRight: 24 }}>{h.sessionTitle || h.courseName || "A session"}</span>
                                  {h.courseName && h.sessionTitle && <span style={{ fontSize: 12.5, color: BRAND.muted }}>{h.courseName}</span>}
                                  {h.message && <span style={{ fontSize: 13, color: BRAND.inkSoft }}>“{h.message}”</span>}
                                  <Tick on={on} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
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
                      <label htmlFor="bk-topic" style={{ ...label, marginTop: 14 }}>What should the mentor know? <span style={{ fontWeight: 500, color: BRAND.faint }}>(optional if you chose a course)</span></label>
                      <textarea id="bk-topic" value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. She doesn't understand loops in Scratch." style={{ ...control, resize: "vertical", minHeight: 84 }} />
                    </Step>

                    <Step n={4} title="How long?" done={!!length} summary={steps[3].value}>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))" }}>
                        {options.lengths.map((l) => {
                          const on = minutes === l.minutes;
                          return (
                            <button key={l.minutes} type="button" aria-pressed={on} onClick={() => setMinutes(l.minutes)} style={{ ...option(on), flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 17, fontWeight: 900 }}><FiClock size={15} color={BRAND.mid} /> {lengthLabel(l.minutes)}</span>
                              <span style={{ fontSize: 13.5, color: BRAND.inkSoft, fontWeight: 700 }}>{included ? <><span style={{ textDecoration: "line-through", opacity: 0.6 }}>{ksh(l.price)}</span> Included</> : ksh(l.price)}</span>
                              <Tick on={on} />
                            </button>
                          );
                        })}
                      </div>
                      {included && <p style={{ margin: "12px 0 0", fontSize: 13.5, color: BRAND.navy, display: "flex", alignItems: "center", gap: 6 }}><FiCheck /> Included in {options.allowance.pathwayName} — {options.allowance.left} of {options.allowance.included} left this period.</p>}
                    </Step>

                    <Step n={5} title="Where?" done={!!placeChosen} summary={steps[4].value}>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
                        <button type="button" aria-pressed={mode === "online"} onClick={() => setMode("online")} style={option(mode === "online")}>
                          <span style={{ width: 42, height: 42, borderRadius: 12, background: BRAND.navy, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><FiVideo size={20} /></span>
                          <span><span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>Online</span><span style={{ fontSize: 13, color: BRAND.muted }}>Join from home with a link</span></span>
                          <Tick on={mode === "online"} />
                        </button>
                        <button type="button" aria-pressed={mode === "hub"} onClick={() => setMode("hub")} disabled={!options.hubs.length} style={option(mode === "hub", !options.hubs.length)}>
                          <span style={{ width: 42, height: 42, borderRadius: 12, background: BRAND.gold, color: BRAND.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><FiMapPin size={20} /></span>
                          <span><span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>At a hub</span><span style={{ fontSize: 13, color: BRAND.muted }}>{options.hubs.length ? "Meet in a learning space" : "No hub space open yet"}</span></span>
                          <Tick on={mode === "hub"} />
                        </button>
                      </div>
                      {mode === "hub" && (
                        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                          <div>
                            <span style={label}>Which hub?</span>
                            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))" }}>
                              {options.hubs.map((h) => {
                                const on = hubId === h.id;
                                return (
                                  <button key={h.id} type="button" aria-pressed={on} onClick={() => { setHubId(h.id); setSpaceId(""); }} style={{ ...option(on), flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                    <span style={{ fontSize: 14.5, fontWeight: 800, paddingRight: 24 }}>{h.name}</span>
                                    {h.town && <span style={{ fontSize: 12.5, color: BRAND.muted }}>{h.town}</span>}
                                    <Tick on={on} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {hub && (
                            <div>
                              <span style={label}>Which space at {hub.name}?</span>
                              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))" }}>
                                {hub.spaces.map((s) => {
                                  const on = spaceId === s.id;
                                  return (
                                    <button key={s.id} type="button" aria-pressed={on} onClick={() => setSpaceId(s.id)} style={{ ...option(on), flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                      <span style={{ fontSize: 14.5, fontWeight: 800, paddingRight: 24 }}>{s.name}</span>
                                      <span style={{ fontSize: 13, color: BRAND.inkSoft }}>{hub.hasDesk ? "No charge" : s.pricingModel === "free" || !s.rate ? "Free" : `${ksh(s.rate)} ${s.priceUnit || ""}`.trim()}</span>
                                      <Tick on={on} />
                                    </button>
                                  );
                                })}
                              </div>
                              {hub.hasDesk && <p style={{ margin: "10px 0 0", fontSize: 13.5, color: BRAND.navy }}>{child?.firstName || "Your child"} already has a desk at {hub.name}, so there&apos;s no space fee.</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </Step>

                    {length && placeChosen && (
                      <Step n={6} title="When?" note={`Times are at least ${options.noticeHours} hours away.`} done={!!slot} summary={steps[5].value}>
                        {timesLoading ? <p style={{ margin: 0, fontSize: 14, color: BRAND.faint }}>Finding free times…</p>
                          : timesError ? <p style={{ margin: 0, fontSize: 14, color: BRAND.danger }}>{errorText(timesError)}</p>
                            : !byDay.size ? <p style={{ margin: 0, fontSize: 14, color: BRAND.muted }}>No free times in the next few weeks{mode === "hub" ? " at this space" : ""}. Try another length{mode === "hub" ? ", space" : ""} or mentor.</p> : (
                              <TimePicker byDay={byDay} day={day} setDay={(d) => { setDay(d); setSlot(null); }} slot={slot} setSlot={setSlot} />
                            )}
                      </Step>
                    )}
                  </>
                ))}
        </div>

        {/* Your booking: beside the steps (stays in view) on a laptop, under them otherwise. */}
        {wide ? <div style={{ position: "sticky", top: 16 }}>{summary}</div> : summary}
      </div>

      {/* On a phone: the total and the one next thing to do, always at hand. */}
      {phone && (
        <div style={{ position: "fixed", left: 0, bottom: 0, width: "100%", zIndex: 1100, background: "#fff", borderTop: `1px solid ${BRAND.border}`, boxShadow: "0 -8px 24px rgba(15,23,42,0.10)", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 12, boxSizing: "border-box", fontFamily: FONT }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 700 }}>{doneCount} of 6 done</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: BRAND.ink }}>{length ? (total > 0 ? (forChild ? credit(total) : ksh(total - creditsApplied)) : "Nothing to pay") : "—"}</div>
          </div>
          {ready ? (
            <button type="button" onClick={submit} disabled={book.isPending} style={{ padding: "12px 18px", minHeight: 48, borderRadius: 12, border: "none", background: BRAND.gold, color: BRAND.navy, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
              {book.isPending ? "Booking…" : forChild ? (total > 0 ? "Book with credits" : "Book") : total - creditsApplied > 0 ? "Book and pay" : "Book"}
            </button>
          ) : (
            <button type="button" onClick={() => nextStep && scrollToStep(nextStep.n)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 16px", minHeight: 48, borderRadius: 12, border: "none", background: BRAND.navy, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
              Next: {nextStep?.short || "—"} <FiArrowRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Notice({ tone = "neutral", children }) {
  const look = tone === "danger" ? { background: BRAND.dangerTint, borderColor: BRAND.dangerBorder, color: BRAND.danger }
    : tone === "gold" ? { background: BRAND.goldTint, borderColor: BRAND.goldBorder, color: BRAND.goldText }
      : { color: BRAND.inkSoft };
  return <div role={tone === "danger" ? "alert" : "status"} style={{ ...card, padding: "16px 20px", fontSize: 14.5, display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.5, ...look }}><FiAlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{children}</span></div>;
}

function MentorCard({ m, on, onPick, forChild = false }) {
  const [first, ...rest] = m.name.split(" ");
  const order = Object.keys(WEEKDAYS);
  const days = [...(m.availability || [])].sort((x, y) => order.indexOf(x) - order.indexOf(y)).map((d) => WEEKDAYS[d] || d);
  return (
    <div style={{ ...option(on), flexDirection: "column", alignItems: "stretch", gap: 10, padding: 16, cursor: "default" }}>
      <button type="button" aria-pressed={on} onClick={onPick} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <Avatar firstName={first} lastName={rest.join(" ")} photo={m.photo} size={54} />
        <span style={{ minWidth: 0, paddingRight: 24 }}>
          <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: BRAND.ink }}>{m.name}</span>
          <span style={{ display: "flex", gap: 10, fontSize: 13, color: BRAND.muted, flexWrap: "wrap", marginTop: 2 }}>
            {m.rating?.isNew ? <span>New mentor</span> : <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><FiStar size={12} color={BRAND.gold} fill={BRAND.gold} /> {m.rating.average.toFixed(1)} ({m.rating.count})</span>}
            <span>{m.hours} h taught</span>
          </span>
        </span>
      </button>
      {m.headline && <p style={{ margin: 0, fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.headline}</p>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12, fontWeight: 700 }}>
        {m.teaches?.online && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: BRAND.skyTint, color: BRAND.skyText }}><FiVideo size={11} /> Online</span>}
        {m.teaches?.inPerson && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: BRAND.goldTint, color: BRAND.goldText }}><FiMapPin size={11} /> In person</span>}
        {days.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: BRAND.greyTint, color: BRAND.greyText }}><FiCalendar size={11} /> {days.join(", ")}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={onPick} style={{ flex: 1, padding: "10px 12px", minHeight: 42, borderRadius: 10, border: "none", background: on ? BRAND.navy : BRAND.skyTint, color: on ? "#fff" : BRAND.navy, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>{on ? "Chosen" : `Choose ${first}`}</button>
        {m.slug && <Link to={forChild ? `/public/educators/${m.slug}` : `/parent/mentors/${m.slug}`} target={forChild ? "_blank" : undefined} style={{ padding: "10px 12px", minHeight: 42, boxSizing: "border-box", display: "inline-flex", alignItems: "center", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, color: BRAND.inkSoft, fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>Profile</Link>}
      </div>
      <Tick on={on} />
    </div>
  );
}

function TimePicker({ byDay, day, setDay, slot, setSlot }) {
  const slots = byDay.get(day) || [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <span style={label}>Day</span>
        <div className="bk-row" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "thin" }}>
          {[...byDay.keys()].map((d) => {
            const on = day === d;
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => setDay(d)}
                style={{ flexShrink: 0, minWidth: 76, padding: "10px 12px", borderRadius: 14, border: `2px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.ink, fontFamily: FONT, cursor: "pointer", display: "grid", justifyItems: "center", gap: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>{dayLabel(d, { weekday: "short" })}</span>
                <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{dayLabel(d, { day: "numeric" })}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.8 }}>{dayLabel(d, { month: "short" })}</span>
                <span style={{ fontSize: 11, marginTop: 2, color: on ? BRAND.gold : BRAND.mid, fontWeight: 800 }}>{byDay.get(d).length} free</span>
              </button>
            );
          })}
        </div>
      </div>
      {PARTS.map(({ key, label: partLabel, Icon }) => {
        const list = slots.filter((s) => partOfDay(s.startTime) === key);
        if (!list.length) return null;
        return (
          <div key={key}>
            <span style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><Icon size={14} color={BRAND.mid} /> {partLabel}</span>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 118px), 1fr))" }}>
              {list.map((s) => {
                const on = slot?.key === s.key;
                return (
                  <button key={s.key} type="button" aria-pressed={on} onClick={() => setSlot(s)}
                    style={{ padding: "11px 8px", minHeight: 46, borderRadius: 12, border: `2px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.ink, fontSize: 14.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer" }}>
                    {s.startTime}<span style={{ fontWeight: 600, opacity: 0.75 }}>–{s.endTime}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Summary({ steps, total, mentorFee, deskFee, included, length, mode, hub, space, options, ready, book, submit, nextStep, childName, forChild, credits, creditsApplied, useCredits, setUseCredits, childPay }) {
  const toPay = total - creditsApplied;
  return (
    <section aria-label="Your booking" style={{ ...card, padding: "20px 22px", fontFamily: FONT, border: `1.5px solid ${BRAND.skyBorder}`, display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: BRAND.ink }}>Your booking</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {steps.map((s) => (
          <li key={s.n}>
            <button type="button" onClick={() => scrollToStep(s.n)} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", width: "100%", boxSizing: "border-box", padding: "8px 4px", borderBottom: `1px solid ${BRAND.line}` }}>
              <span aria-hidden style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: s.done ? BRAND.skyTint : BRAND.greyTint, color: s.done ? BRAND.navy : BRAND.faint }}><s.Icon size={15} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.short}</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: s.value ? 700 : 500, color: s.value ? BRAND.ink : BRAND.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.value || "Not chosen yet"}</span>
              </span>
              {s.done && <FiCheck color={BRAND.mid} />}
            </button>
          </li>
        ))}
      </ul>
      {length && (
        <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>Mentor session · {lengthLabel(length.minutes)}</span><span>{included ? "Included" : ksh(mentorFee)}</span></div>
          {mode === "hub" && space && <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{space.name} at {hub.name}</span><span>{deskFee ? ksh(deskFee) : "No charge"}</span></div>}
          {forChild ? (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: `1px solid ${BRAND.line}`, fontWeight: 900, fontSize: 18 }}><span>Credits</span><span>{credit(total)}</span></div>
          ) : (
            <>
              {creditsApplied > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: BRAND.navy, fontWeight: 700 }}><span>From your credits</span><span>− {ksh(creditsApplied)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: `1px solid ${BRAND.line}`, fontWeight: 900, fontSize: 18 }}><span>To pay</span><span>{ksh(toPay)}</span></div>
            </>
          )}
        </div>
      )}
      {/* A parent with credits here may use them. */}
      {!forChild && length && total > 0 && credits?.enabled && credits.balance > 0 && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${useCredits ? BRAND.navy : BRAND.border}`, background: useCredits ? BRAND.skyTint : "#fff", cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={useCredits} onChange={(e) => setUseCredits(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
          <span><strong>Pay with credits</strong><span style={{ display: "block", fontSize: 12.5, color: BRAND.muted }}>You have {credit(credits.balance)}.{credits.balance < total ? " They cover part of it; the rest goes on the invoice." : " It's booked straight away."}</span></span>
        </label>
      )}
      {forChild && length && credits && (
        <div style={{ padding: "10px 12px", borderRadius: 12, background: childPay.ok || total === 0 ? BRAND.skyTint : BRAND.goldTint, color: childPay.ok || total === 0 ? BRAND.navy : BRAND.goldText, fontSize: 13.5, lineHeight: 1.5 }}>
          {total === 0 ? "Nothing to pay. It's booked straight away."
            : childPay.ok ? `Your family has ${credit(credits.balance)}. After this booking: ${credit(credits.balance - total)}. Your parent is told.`
              : childPay.reason}
        </div>
      )}
      {options?.enabled && (
        <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, display: "flex", gap: 6, lineHeight: 1.5 }}>
          <FiInfo size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {forChild ? `You can cancel up to ${options.cancelHours} hours before and the credits go back.`
              : <>{toPay > 0 ? `We hold the time for ${options.holdMinutes >= 60 ? `${Math.round(options.holdMinutes / 60)} hour${options.holdMinutes >= 120 ? "s" : ""}` : `${options.holdMinutes} minutes`} while you pay — once paid, it's booked. ` : "Nothing more to pay — it's booked straight away. "}
                You can cancel up to {options.cancelHours} hours before for your money back{creditsApplied > 0 ? " (credits go straight back to your wallet)" : ""}.</>}
          </span>
        </p>
      )}
      <button type="button" onClick={ready ? submit : () => nextStep && scrollToStep(nextStep.n)} disabled={book.isPending}
        style={{ padding: "14px 20px", minHeight: 50, borderRadius: 12, border: "none", background: ready ? BRAND.gold : BRAND.navy, color: ready ? BRAND.navy : "#fff", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {book.isPending ? "Booking…" : ready ? (forChild ? (total > 0 ? `Book with ${credit(total)}` : "Book") : toPay > 0 ? `Book and pay ${ksh(toPay)}` : creditsApplied > 0 ? `Book with ${credit(creditsApplied)}` : "Book") : forChild && length && total > 0 && !childPay.ok && nextStep == null ? "Ask your parent" : <>Next: {nextStep?.short === "Help with" ? `what ${childName} needs help with` : (nextStep?.short || "").toLowerCase()} <FiArrowRight /></>}
      </button>
    </section>
  );
}
