import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowRight, FiBookOpen, FiCalendar, FiExternalLink, FiEye, FiEyeOff, FiGlobe, FiHome, FiMail, FiPhone, FiSettings, FiShield, FiTarget, FiTrendingUp, FiUser, FiUserCheck, FiUsers } from "react-icons/fi";
import { useUpdateTeacher } from "../../teachers/hooks/useTeacher";
import { classApi } from "../../classes/services/classApi";
import AvatarPhotoEditor from "../../../components/ui/AvatarPhotoEditor";
import EmailNotificationSettings from "../../../components/ui/EmailNotificationSettings";
import { Tabs } from "../../../components/ui/TabBar";
import { QaStyles as CheckinStyles, btn, input, label } from "../../qa/shared";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import { useMyEducatorProfile } from "../../educator-profiles/hooks/useEducatorProfile";
import { CoursesTaught, OverviewPanel, ProfileKpis, QualityPanel, TeachingPanel } from "../../educator-profiles/components/PerformanceProfile";
import StandardsCard from "../../mentor-standards/StandardsCard";
import PublicProfileEditor, { OWN_STATE } from "../../educator-profiles/components/PublicProfileEditor";

// The teacher portal's My profile (/teacher-portal/profile) — one place for everything about the
// educator: their header (photo, status, headline, hubs, their public profile's state), the figures
// that matter (each opens its tab), and six tabs —
//   Overview            in short, what to work on (standards not met, with what helps), badges.
//   Standards           where they stand against the workspace's mentor standards.
//   Quality & feedback  their QA visits compounded, what parents say.
//   Teaching            their classes and hubs, teaching figures, hours, courses taught.
//   Public profile      what they write about themself, sharing it (an admin approves), preview, link.
//   Account             contact details, password, email notifications.
// The old /teacher-portal/my-profile opens the Public profile tab. System colours (theme/brand.js).

const TABS = [
  { key: "overview", label: "Overview", icon: FiTrendingUp },
  { key: "standards", label: "Standards", icon: FiTarget },
  { key: "quality", label: "Quality & feedback", icon: FiShield },
  { key: "teaching", label: "Teaching", icon: FiBookOpen },
  { key: "public", label: "Public profile", icon: FiGlobe },
  { key: "account", label: "Account", icon: FiSettings },
];
// Tabs that read the profile's figures (the key figures show above them).
const FIGURE_TABS = ["overview", "standards", "quality", "teaching"];
const STATUS = { active: ["Active", "good"], inactive: ["Inactive", "neutral"], on_leave: ["On leave", "waiting"], in_training: ["In training", "info"] };
const box = { ...card, overflow: "hidden" };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—");

function Section({ title, icon: Icon, action, children }) {
  return (
    <section style={box}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BRAND.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h2 style={cardHeading}>{Icon && <Icon size={12} />} {title}</h2>
        {action}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </section>
  );
}

function Detail({ icon: Icon, label: text, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <Icon size={15} color={BRAND.faint} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: BRAND.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{text}</p>
        <p style={{ margin: "2px 0 0", fontSize: 14, color: BRAND.ink, overflowWrap: "anywhere" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

function AccountTab({ teacher }) {
  const { mutate: updateTeacher, isPending: saving } = useUpdateTeacher();
  const { mutate: changePassword, isPending: savingPassword } = useUpdateTeacher();
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(teacher.firstName || "");
  const [last, setLast] = useState(teacher.lastName || "");
  const [phone, setPhone] = useState(teacher.phone || "");
  const [changing, setChanging] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pwError, setPwError] = useState("");

  const cancelContact = () => { setEditing(false); setFirst(teacher.firstName || ""); setLast(teacher.lastName || ""); setPhone(teacher.phone || ""); };
  const saveContact = () => updateTeacher({ id: teacher.id, data: { firstName: first.trim(), lastName: last.trim(), phone: phone.trim() } }, { onSuccess: () => setEditing(false) });
  const savePassword = () => {
    if (pw.length < 8) { setPwError("Must be at least 8 characters"); return; }
    if (pw !== confirm) { setPwError("Passwords don't match"); return; }
    setPwError("");
    changePassword({ id: teacher.id, data: { password: pw } }, { onSuccess: () => { setChanging(false); setPw(""); setConfirm(""); } });
  };
  const linkBtn = { background: "none", border: "none", color: BRAND.mid, fontWeight: 700, fontSize: 12.5, fontFamily: FONT, cursor: "pointer", padding: 0 };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", alignItems: "start" }}>
      <Section title="Contact details" icon={FiUser} action={!editing && <button type="button" onClick={() => setEditing(true)} style={linkBtn}>Edit</button>}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
          <Detail icon={FiMail} label="Email" value={teacher.email} />
          {editing ? (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))" }}>
                <div><label htmlFor="pf-first" style={label}>First name</label><input id="pf-first" value={first} onChange={(e) => setFirst(e.target.value)} style={input} /></div>
                <div><label htmlFor="pf-last" style={label}>Last name</label><input id="pf-last" value={last} onChange={(e) => setLast(e.target.value)} style={input} /></div>
              </div>
              <div><label htmlFor="pf-phone" style={label}>Phone</label><input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000 000" style={input} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="ci-btn" onClick={saveContact} disabled={saving} style={btn("primary", { disabled: saving })}>{saving ? "Saving…" : "Save"}</button>
                <button type="button" className="ci-btn" onClick={cancelContact} style={btn("secondary")}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <Detail icon={FiUser} label="Name" value={`${teacher.firstName} ${teacher.lastName}`} />
              <Detail icon={FiPhone} label="Phone" value={teacher.phone} />
              <Detail icon={FiCalendar} label="With us since" value={fmtDate(teacher.createdAt)} />
            </>
          )}
          <p style={{ margin: 0, fontSize: 11.5, color: BRAND.faint }}>Your email and hubs are managed by your administrator.</p>
        </div>
      </Section>

      <Section title="Sign-in & security" icon={FiShield} action={!changing && <button type="button" onClick={() => setChanging(true)} style={linkBtn}>Change password</button>}>
        {changing ? (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
            <div>
              <label htmlFor="pf-pw" style={label}>New password</label>
              <div style={{ position: "relative" }}>
                <input id="pf-pw" type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" style={{ ...input, paddingRight: 38 }} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: BRAND.faint, cursor: "pointer", display: "flex" }}>
                  {show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>
            <div><label htmlFor="pf-pw2" style={label}>Confirm password</label><input id="pf-pw2" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} /></div>
            {pwError && <p style={{ margin: 0, fontSize: 12, color: BRAND.danger }}>{pwError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="ci-btn" onClick={savePassword} disabled={savingPassword} style={btn("primary", { disabled: savingPassword })}>{savingPassword ? "Saving…" : "Save"}</button>
              <button type="button" className="ci-btn" onClick={() => { setChanging(false); setPw(""); setConfirm(""); setPwError(""); }} style={btn("secondary")}>Cancel</button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>One password for every role you sign in as. Change it here any time.</p>
        )}
      </Section>

      <div style={{ gridColumn: "1 / -1" }}>
        <Section title="Email notifications" icon={FiMail}>
          <EmailNotificationSettings padding={0} />
        </Section>
      </div>
    </div>
  );
}

// Where they teach — their hubs as chips and their classes as one compact list — then the teaching
// figures, hours and courses (from the profile).
function TeachingTab({ teacher, hubs, courses, profile }) {
  const navigate = useNavigate();
  const { data: classesData } = useQuery({
    queryKey: ["classes", "byClassTeacher", teacher.id],
    queryFn: () => classApi.getAll({ teacherId: teacher.id }),
    enabled: !!teacher.id,
  });
  const classes = classesData?.data || [];
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      <Section title="Where you teach" icon={FiHome}>
        {hubs?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {hubs.map((h) => (
              <span key={h.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: BRAND.skyTint, border: `1px solid ${BRAND.skyBorder}`, fontSize: 13, fontWeight: 700, color: BRAND.navy }}>
                <FiHome size={13} /> {h.name}{h.address?.county ? <span style={{ fontWeight: 500, color: BRAND.muted }}> · {h.address.county}</span> : null}
              </span>
            ))}
          </div>
        )}
        {classes.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Not teaching a class yet.</p> : (
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
            {classes.map((c) => (
              <button key={c.id} type="button" onClick={() => navigate(`/teacher-portal/classes/${c.id}`)} className="pp-class"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 12, border: `1px solid ${BRAND.line}`, background: BRAND.surface, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
                <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: BRAND.canvas, color: BRAND.mid, display: "grid", placeItems: "center", flexShrink: 0 }}><FiUsers size={16} /></span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: BRAND.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.gradeName}{c.streamName ? ` ${c.streamName}` : ""}</span>
                  <span style={{ display: "block", fontSize: 12, color: BRAND.muted }}>{c.learnerCount ?? 0} learner{(c.learnerCount ?? 0) !== 1 ? "s" : ""}{c.academicYear ? ` · ${c.academicYear}` : ""}</span>
                </span>
                <FiArrowRight size={15} color={BRAND.mid} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
        <style>{`.pp-class { transition: border-color 150ms ease, box-shadow 150ms ease; } .pp-class:hover { border-color: ${BRAND.skyBorder}; box-shadow: 0 4px 12px rgba(37,71,106,0.07); }`}</style>
      </Section>
      {/* Teaching figures, hours over 12 months, courses taught (from the profile); else just the courses. */}
      {profile ? <TeachingPanel profile={profile} /> : <CoursesTaught courses={courses} />}
    </div>
  );
}

export default function ProfilePage() {
  const { teacher, teacherLoading, hubs, email } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useMyEducatorProfile({ enabled: !!teacher?.id });
  const { mutate: updateTeacher } = useUpdateTeacher();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === "overview") next.delete("tab"); else next.set("tab", key);
    setParams(next, { replace: true });
  };
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [tab]);

  if (teacherLoading) return <div style={{ fontFamily: FONT, padding: "60px 20px", textAlign: "center", color: BRAND.faint, fontSize: 14 }}>Loading…</div>;
  if (!teacher) {
    return (
      <div style={{ ...card, fontFamily: FONT, textAlign: "center", padding: "60px 24px" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: BRAND.skyTint, border: `2px solid ${BRAND.skyBorder}`, display: "grid", placeItems: "center", color: BRAND.navy, margin: "0 auto 14px" }}><FiUserCheck size={26} /></div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: BRAND.ink }}>No educator record linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Ask your admin to add you as an educator using this same email address{email ? <>: <strong>{email}</strong></> : "."}</p>
      </div>
    );
  }

  const [statusText, statusTone] = STATUS[teacher.status] || STATUS.inactive;
  const publish = profile?.publish;
  const state = publish ? OWN_STATE[publish.state] : null;
  const headline = profile?.about?.headline || profile?.aboutDraft?.headline || "";

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 16 }}>
      <CheckinStyles />
      {/* Header */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", position: "relative" }}>
          <AvatarPhotoEditor firstName={teacher.firstName} lastName={teacher.lastName} photo={teacher.photo} borderColor="rgba(255,255,255,0.3)" onChange={(photo) => updateTeacher({ id: teacher.id, data: { photo }, successMessage: photo ? "Your photo is saved" : "Your photo was removed" })} />
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>{teacher.firstName} {teacher.lastName}</h1>
              <span style={pill(statusTone)}>{statusText}</span>
            </div>
            {headline && <p style={{ margin: "4px 0 0", fontSize: 14, color: "rgba(255,255,255,0.88)" }}>{headline}</p>}
            {hubs?.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", gap: 6 }}><FiHome size={12} /> {hubs.map((h) => h.name).join(" · ")}</p>}
          </div>
          {state && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <button type="button" onClick={() => setTab("public")} style={{ ...pill(state.tone), cursor: "pointer", fontFamily: FONT }}><FiGlobe size={12} /> Public profile: {state.label}</button>
              {publish.public && publish.slug && (
                <Link to={`/public/educators/${publish.slug}`} target="_blank" style={{ fontSize: 12, fontWeight: 700, color: "#fff", display: "inline-flex", alignItems: "center", gap: 5 }}>View as families see it <FiExternalLink size={11} /></Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The figures that matter — each opens the tab with its detail. */}
      {profile && FIGURE_TABS.includes(tab) && <ProfileKpis profile={profile} onOpen={setTab} />}

      {/* On a phone the tabs wrap onto a second line rather than scroll out of sight. */}
      <div className="pp-tabs"><style>{"@media (max-width: 640px) { .pp-tabs .ui-tab-scroll { flex-wrap: wrap; overflow-x: visible !important; width: 100% !important; } }"}</style><Tabs label="My profile" tabs={TABS.map((t) => (t.key === "public" && publish?.reviewNote && publish.state !== "published" ? { ...t, count: 1, alert: true } : t))} value={tab} onChange={setTab} /></div>

      {tab === "account" ? <AccountTab teacher={teacher} />
        : tab === "teaching" ? <TeachingTab teacher={teacher} hubs={hubs} courses={profile?.stats?.courses || []} profile={profile} />
          : profileLoading || !profile ? <div style={{ padding: "50px 20px", textAlign: "center", color: BRAND.faint, fontSize: 14 }}>Working out your figures…</div>
            : tab === "public" ? <PublicProfileEditor profile={profile} />
              : tab === "standards" ? (profile.standards ? <StandardsCard standing={profile.standards} own /> : <div style={{ ...card, padding: 24, color: BRAND.muted, fontSize: 13.5 }}>No mentor standards are set for your workspace yet.</div>)
                : tab === "quality" ? <QualityPanel profile={profile} />
                  : <OverviewPanel profile={profile} onOpen={setTab} />}
    </div>
  );
}
