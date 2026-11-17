import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowRight, FiBell, FiBriefcase, FiCalendar, FiCheck, FiEdit2, FiFileText, FiInbox, FiLock, FiLogIn, FiMail, FiMapPin, FiPhone, FiShield, FiStar, FiUser, FiUsers, FiX } from "react-icons/fi";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../auth/services/authApi";
import { useSupervisorClaims } from "../hooks/useClaims";
import { useSupervisorMe } from "../../supervisor-portal/hooks/useSupervisorPortal";
import { T, cardStyle, formatDate, inputStyle, primaryButton } from "../shared";
import { Avatar, HeroStat } from "../components/supervisorParts";
import AvatarPhotoEditor from "../../../components/ui/AvatarPhotoEditor";
import EmailNotificationSettings from "../../../components/ui/EmailNotificationSettings";
import { Tabs } from "../../../components/ui/TabBar";

/*
 * The supervisor's own account (/supervisor-portal/profile, redesigned 17 Nov 2026): a header with
 * who they are and their work in figures (GET /api/supervisor-portal/me), then tabs (?tab=):
 *   Overview       my details (phone editable here; name, email and job title are the admin's —
 *                  People → Supervisors), who manages the account, and my team at a glance
 *   Password       change it (one sign-in for every role the login has)
 *   Notifications  which emails they get
 */
const ROLE_LABEL = { teacher: "Educator", collaborator: "Staff", school: "Learning hub", learner: "Parent", affiliate: "Affiliate" };
const TABS = [
  { key: "overview", label: "Overview", icon: FiUser },
  { key: "password", label: "Password", icon: FiLock },
  { key: "notifications", label: "Notifications", icon: FiBell },
];

function Card({ icon: Icon, title, action, children }) {
  return (
    <section style={{ ...cardStyle, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink, flex: 1 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 0", borderTop: "1px solid #F1F5F9" }}>
      <Icon size={15} color={T.inkFaint} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>{label}</p>
        <div style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 600, color: T.ink, overflowWrap: "anywhere" }}>{children}</div>
        {note && <p style={{ margin: "3px 0 0", fontSize: 12, color: T.inkMuted }}>{note}</p>}
      </div>
    </div>
  );
}

function PhoneRow({ phone, onSaved }) {
  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await authApi.updateMe({ phone: value.trim() || null });
      toast.success("Phone saved");
      setValue(null);
      onSaved(value.trim() || null);
    } catch (err) {
      toast.error(err.response?.data?.message || err.errors?.[0]?.message || err.message || "Couldn't save the phone number");
    } finally {
      setSaving(false);
    }
  };
  if (value === null) {
    return (
      <Row icon={FiPhone} label="Phone">
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {phone || <span style={{ color: T.inkMuted, fontWeight: 500 }}>Not added</span>}
          <button type="button" onClick={() => setValue(phone || "")} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: 0, background: "none", color: T.accentMid, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <FiEdit2 size={12} /> {phone ? "Change" : "Add"}
          </button>
        </span>
      </Row>
    );
  }
  return (
    <Row icon={FiPhone} label="Phone">
      <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setValue(null); }} placeholder="e.g. 0712 345 678" aria-label="Phone" maxLength={30} style={{ ...inputStyle, flex: "1 1 180px", padding: "8px 10px" }} />
        <button type="button" disabled={saving} onClick={save} aria-label="Save phone" style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, border: "none", background: T.accent, color: "#fff", cursor: "pointer" }}><FiCheck size={15} /></button>
        <button type="button" onClick={() => setValue(null)} aria-label="Cancel" style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.ink, cursor: "pointer" }}><FiX size={15} /></button>
      </span>
    </Row>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [saving, setSaving] = useState(false);
  const mismatch = form.again.length > 0 && form.next !== form.again;
  const valid = form.current && form.next.length >= 8 && form.next === form.again;
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await authApi.changePassword(form.current, form.next);
      toast.success("Password changed");
      setForm({ current: "", next: "", again: "" });
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not change the password");
    } finally {
      setSaving(false);
    }
  };
  const field = (key, name, autoComplete, hint) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink }}>
      {name}
      <input type="password" autoComplete={autoComplete} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ ...inputStyle, borderColor: key === "again" && mismatch ? "#FCA5A5" : T.border }} />
      {hint && <span style={{ fontSize: 11.5, fontWeight: 500, color: key === "again" && mismatch ? "#B91C1C" : T.inkMuted }}>{hint}</span>}
    </label>
  );
  return (
    <form onSubmit={submit} style={{ maxWidth: 520 }}>
      <Card icon={FiLock} title="Change password">
        <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted, lineHeight: 1.6 }}>Use 8 characters or more. If you sign in to other roles with this email, the new password works for them too.</p>
        {field("current", "Current password", "current-password")}
        {field("next", "New password", "new-password", "8 characters or more.")}
        {field("again", "New password again", "new-password", mismatch ? "The two new passwords don't match." : undefined)}
        <button type="submit" disabled={!valid || saving} style={{ ...primaryButton(!valid || saving), alignSelf: "flex-start" }}>{saving ? "Saving…" : "Change password"}</button>
      </Card>
    </form>
  );
}

export default function SupervisorProfilePage() {
  const { user, updateUser } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const setTab = (key) => setParams(key === "overview" ? {} : { tab: key }, { replace: true });
  const { data: me } = useSupervisorMe();
  const { data: claimsData } = useSupervisorClaims();
  const team = claimsData?.educators || [];
  const f = me?.figures;
  const [firstName, ...rest] = String(user?.name || "").trim().split(/\s+/);

  const savePhoto = async (photo) => {
    try {
      await authApi.updateMe({ photo });
      updateUser({ photo });
      qc.invalidateQueries({ queryKey: ["supervisor-portal", "me"] });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Could not update your photo");
    }
  };
  const phoneSaved = (phone) => {
    updateUser({ phone });
    qc.invalidateQueries({ queryKey: ["supervisor-portal", "me"] });
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ position: "relative", overflow: "hidden", borderRadius: 22, padding: "26px 28px", background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 42%, ${T.accentMid} 78%, ${T.accentLight} 100%)`, boxShadow: "0 14px 34px rgba(37,71,106,0.22)" }}>
        <div style={{ position: "absolute", top: -70, right: -50, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <AvatarPhotoEditor firstName={firstName} lastName={rest.join(" ")} photo={user?.photo} onChange={savePhoto} size={76} />
            <div style={{ minWidth: 0, flex: "1 1 280px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>{me?.name || user?.name}</h1>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(254,177,57,0.95)", color: "#17304B", fontSize: 11.5, fontWeight: 800 }}>Supervisor</span>
                {(me?.otherRoles || []).map((r) => <span key={r} style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 11.5, fontWeight: 700 }}>Also {ROLE_LABEL[r] || r}</span>)}
              </div>
              {me?.jobTitle && <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{me.jobTitle}</p>}
              <div style={{ display: "flex", gap: "6px 18px", flexWrap: "wrap", marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiMail size={13} /> {me?.email || user?.email}</span>
                {me?.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiPhone size={13} /> {me.phone}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <HeroStat icon={FiUsers} value={f ? f.educators : "—"} label="Educators" sub={f ? `at ${f.schools} school${f.schools === 1 ? "" : "s"}` : ""} />
            <HeroStat icon={FiInbox} value={f ? f.claimsWaiting : "—"} label="Claims waiting" sub={f ? `${f.claimsDecided} decided so far` : ""} />
            <HeroStat icon={FiStar} value={f ? f.qaReports : "—"} label="QA reports sent" sub={f ? `${f.qaPlanned} visit${f.qaPlanned === 1 ? "" : "s"} planned` : ""} />
          </div>
        </div>
      </section>

      <div className="pp-tabs"><style>{"@media (max-width: 640px) { .pp-tabs .ui-tab-scroll { flex-wrap: wrap; overflow-x: visible !important; width: 100% !important; } }"}</style><Tabs label="My Profile" tabs={TABS} value={tab} onChange={setTab} /></div>

      {tab === "overview" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <Card icon={FiUser} title="My details">
              <div>
                <Row icon={FiUser} label="Name">{me?.name || user?.name}</Row>
                <Row icon={FiMail} label="Email" note="You sign in with this.">{me?.email || user?.email}</Row>
                <PhoneRow phone={me?.phone} onSaved={phoneSaved} />
                <Row icon={FiBriefcase} label="Job title">{me?.jobTitle || <span style={{ color: T.inkMuted, fontWeight: 500 }}>Not set</span>}</Row>
                <Row icon={FiCalendar} label="Supervisor since">{formatDate(me?.createdAt || user?.createdAt)}</Row>
                <Row icon={FiLogIn} label="Signed in before this">{me?.previousSignInAt ? formatDate(me.previousSignInAt) : <span style={{ color: T.inkMuted, fontWeight: 500 }}>This is your first time</span>}</Row>
                {me?.managedBy && (
                  <Row icon={FiShield} label="Managed by" note="They set your name, email, job title and the educators you look after — ask them if any of it needs changing.">
                    {me.managedBy.name}{me.managedBy.email && <> · <a href={`mailto:${me.managedBy.email}`} style={{ color: T.accentMid, textDecoration: "none", fontWeight: 600 }}>{me.managedBy.email}</a></>}
                  </Row>
                )}
              </div>
            </Card>
          </div>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <Card icon={FiUsers} title="My team" action={<Link to="/supervisor-portal/educators" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: T.accentMid, textDecoration: "none" }}>My Educators <FiArrowRight size={12} /></Link>}>
              {team.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>No educators are assigned to you yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {team.slice(0, 8).map((e) => (
                    <Link key={e.id} to={`/supervisor-portal/educators/${e.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid #F1F5F9", textDecoration: "none", color: "inherit" }}>
                      <Avatar name={e.name} photo={e.photo} size={34} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.name}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><FiMapPin size={11} /> {(e.schools || []).map((s) => s.name).join(", ") || "No school yet"}</span>
                      </span>
                      <FiArrowRight size={14} color={T.inkFaint} />
                    </Link>
                  ))}
                  {team.length > 8 && <Link to="/supervisor-portal/educators" style={{ paddingTop: 10, borderTop: "1px solid #F1F5F9", fontSize: 12.5, fontWeight: 700, color: T.accentMid, textDecoration: "none" }}>and {team.length - 8} more</Link>}
                </div>
              )}
              {f && (f.claimsWaiting > 0 || f.qaPlanned > 0) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {f.claimsWaiting > 0 && <Link to="/supervisor-portal/claims" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "#FFF4DC", color: "#92400E", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}><FiFileText size={13} /> {f.claimsWaiting} claim{f.claimsWaiting === 1 ? "" : "s"} to review</Link>}
                  {f.qaPlanned > 0 && <Link to="/supervisor-portal/qa" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: T.tintBg, color: T.accent, fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}><FiStar size={13} /> {f.qaPlanned} QA visit{f.qaPlanned === 1 ? "" : "s"} planned</Link>}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "password" && <PasswordCard />}

      {tab === "notifications" && (
        <div style={{ maxWidth: 720 }}>
          <Card icon={FiBell} title="Email notifications">
            <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted }}>Choose which emails you get. You still see everything in the bell at the top.</p>
            <EmailNotificationSettings padding={0} />
          </Card>
        </div>
      )}
    </div>
  );
}
