import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiKey, FiRefreshCw, FiRepeat, FiSearch, FiUser, FiUserCheck, FiUserPlus, FiUsers } from "react-icons/fi";
import { useCreateSupervisor, useSupervisorCandidates, useSupervisorEducatorOptions } from "../../claims/hooks/useClaims";
import EducatorPicker from "../components/EducatorPicker";
import { T, cardStyle } from "../../claims/shared";
import { Avatar } from "../../claims/components/supervisorParts";

/*
 * People → Supervisors → Add supervisor (17 Nov 2026), in three parts:
 *   1. Who          someone NEW (a new login: name, email, phone, job title) or SOMEONE ALREADY HERE
 *                   — an educator who signs in, or a staff member (GET /api/claims/supervisors/
 *                   candidates). Someone already here keeps their one login and password and gains
 *                   Supervisor as another role: at sign-in they choose which portal to open
 *                   (RoleChooser) and switch from the top bar (RoleSwitcher) — users.extraRoles.
 *   2. Signing in   a password, only for a new login (the server never replaces an existing one's)
 *   3. Their educators (optional; their own educator record is left out)
 * Server: SupervisorService.create.
 */
const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "inherit", color: T.ink };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: T.ink };
const hint = { fontSize: 12, fontWeight: 500, color: T.inkMuted, lineHeight: 1.5 };
const ROLE_LABEL = { teacher: "Educator", collaborator: "Staff" };
const PORTAL = { teacher: "Educator portal", collaborator: "Admin app (staff)" };

function Step({ n, icon: Icon, title, subtitle, children }) {
  return (
    <section style={{ ...cardStyle, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: "50%", background: T.accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{n}</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 7 }}><Icon size={15} /> {title}</h2>
          {subtitle && <p style={{ margin: "3px 0 0", ...hint }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Choice({ on, icon: Icon, title, line, onClick }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ flex: "1 1 260px", display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", padding: "14px 16px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? "#F0F7FF" : "#fff", boxShadow: on ? "0 0 0 3px rgba(37,71,106,0.08)" : "none" }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: on ? T.accent : T.tintBg, color: on ? "#fff" : T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={17} /></span>
      <span>
        <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</span>
        <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: T.inkMuted, lineHeight: 1.5 }}>{line}</span>
      </span>
    </button>
  );
}

function RoleTags({ roles }) {
  return roles.map((r) => <span key={r} style={{ padding: "2px 8px", borderRadius: 999, background: T.tintBg, color: T.accent, fontSize: 11, fontWeight: 800 }}>{ROLE_LABEL[r] || r}</span>);
}

// A readable random password: 4-character chunks of letters and digits.
function makePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
}

export default function NewSupervisorPage() {
  const navigate = useNavigate();
  const create = useCreateSupervisor();
  const { data: options = [], isLoading: optionsLoading } = useSupervisorEducatorOptions();
  const { data: candidates = [], isLoading: candidatesLoading } = useSupervisorCandidates();
  const [mode, setMode] = useState("new");
  const [pickedId, setPickedId] = useState(null);
  const [find, setFind] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", jobTitle: "", password: "" });
  const [educators, setEducators] = useState(() => new Set());
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const picked = mode === "existing" ? candidates.find((c) => c.id === pickedId) || null : null;
  // A "new" email that already signs in here: offer to switch to "someone already here".
  const typedMatch = mode === "new" ? candidates.find((c) => c.email && c.email.toLowerCase() === form.email.trim().toLowerCase()) : null;
  const q = find.trim().toLowerCase();
  const shownCandidates = useMemo(() => candidates.filter((c) => !q || `${c.name} ${c.email}`.toLowerCase().includes(q)), [candidates, q]);
  const ownEmail = picked ? picked.email : typedMatch ? typedMatch.email : form.email;

  const pick = (c) => {
    setPickedId(c.id);
    setForm((f) => ({ ...f, phone: c.phone || "", jobTitle: c.jobTitle || "" }));
    // Their own educator record can't be one they supervise.
    if (c.teacherId) setEducators((s) => { const n = new Set(s); n.delete(c.teacherId); return n; });
  };
  const switchToExisting = (c) => { setMode("existing"); pick(c); };

  const valid = mode === "existing"
    ? !!picked
    : form.name.trim() && /\S+@\S+\.\S+/.test(form.email.trim()) && !typedMatch && form.password.length >= 8;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    setError("");
    const body = mode === "existing"
      ? { name: picked.name, email: picked.email, phone: form.phone.trim(), jobTitle: form.jobTitle.trim(), teacherIds: [...educators] }
      : { ...form, name: form.name.trim(), email: form.email.trim(), teacherIds: [...educators] };
    create.mutate(body, {
      onSuccess: (s) => {
        toast.success(s.linked ? `${s.name} is now a supervisor too — they choose which portal when they sign in` : `${s.name} added as a supervisor`);
        navigate(`/supervisors/${s.id}`, { replace: true });
      },
      onError: (err) => setError(err?.response?.data?.message || err?.message || "The supervisor couldn't be added"),
    });
  };

  return (
    <form onSubmit={submit} style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <Link to="/supervisors" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> Supervisors</Link>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.ink }}>Add a supervisor</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>They sign in on the normal login page and open the supervisor portal.</p>
      </div>

      <Step n={1} icon={FiUser} title="Who will supervise?">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Choice on={mode === "existing"} icon={FiUserCheck} title={`Someone already here${candidates.length ? ` (${candidates.length})` : ""}`}
            line="An educator or staff member who already signs in. They keep their login and password, and get the supervisor portal as well." onClick={() => setMode("existing")} />
          <Choice on={mode === "new"} icon={FiUserPlus} title="Someone new" line="A new sign-in, only for supervising." onClick={() => setMode("new")} />
        </div>

        {mode === "existing" && (
          picked ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${T.tintBorder}`, background: "#F7FBFE" }}>
              <Avatar name={picked.name} photo={picked.photo} size={46} />
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{picked.name} <RoleTags roles={picked.roles} /></p>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>{picked.email}</p>
              </div>
              <button type="button" onClick={() => setPickedId(null)} style={{ padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Choose someone else</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ position: "relative", display: "block" }}>
                <FiSearch size={14} aria-hidden style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
                <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search educators and staff by name or email" aria-label="Search people" style={{ ...field, paddingLeft: 32 }} />
              </label>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, maxHeight: 320, overflowY: "auto" }}>
                {candidatesLoading && <p style={{ margin: 0, padding: 14, fontSize: 13, color: T.inkMuted }}>Loading…</p>}
                {!candidatesLoading && shownCandidates.length === 0 && (
                  <p style={{ margin: 0, padding: 14, fontSize: 13, color: T.inkMuted }}>{candidates.length ? "No one matches." : "No educators or staff who sign in yet — add someone new instead."}</p>
                )}
                {shownCandidates.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(c)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "10px 12px", border: 0, borderBottom: "1px solid #F3F4F6", background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                    <Avatar name={c.name} photo={c.photo} size={32} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{c.name}</span>
                      <span style={{ display: "block", fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</span>
                    </span>
                    <span style={{ display: "flex", gap: 4 }}><RoleTags roles={c.roles} /></span>
                    <FiArrowRight size={14} color={T.inkFaint} />
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {mode === "new" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <label style={{ ...label, flex: "1 1 260px" }}>Full name *<input required value={form.name} onChange={set("name")} maxLength={150} style={field} /></label>
            <label style={{ ...label, flex: "1 1 260px" }}>Email *<input required type="email" value={form.email} onChange={set("email")} style={field} /><span style={hint}>Their sign-in.</span></label>
          </div>
        )}
        {typedMatch && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 13, color: "#92400E" }}>
            <span style={{ flex: "1 1 260px" }}><strong>{typedMatch.name}</strong> already signs in here as {typedMatch.roles.map((r) => ROLE_LABEL[r] || r).join(" and ")}.</span>
            <button type="button" onClick={() => switchToExisting(typedMatch)} style={{ padding: "6px 12px", borderRadius: 9, border: "none", background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Make them a supervisor</button>
          </div>
        )}
        {(mode === "new" || picked) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <label style={{ ...label, flex: "1 1 260px" }}>Phone<input value={form.phone} onChange={set("phone")} maxLength={30} placeholder="e.g. 0712 345 678" style={field} />{picked && <span style={hint}>Saved only if their login has no phone yet.</span>}</label>
            <label style={{ ...label, flex: "1 1 260px" }}>Job title<input value={form.jobTitle} onChange={set("jobTitle")} maxLength={100} placeholder="e.g. Programmes Lead" style={field} />{picked && <span style={hint}>Saved only if they have none yet.</span>}</label>
          </div>
        )}
      </Step>

      <Step n={2} icon={FiKey} title="Signing in">
        {mode === "existing" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>
              {picked ? <><strong>{picked.name.split(/\s+/)[0]}</strong> keeps</> : "They keep"} the email and password they use now — nothing new to share. From now on their one sign-in opens:
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(picked ? picked.roles : ["teacher"]).map((r) => (
                <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: T.ink }}><FiCheckCircle size={14} color="#059669" /> {PORTAL[r] || r}</span>
              ))}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${T.accent}`, background: "#F0F7FF", fontSize: 13, fontWeight: 800, color: T.accent }}><FiCheckCircle size={14} /> Supervisor portal · new</span>
            </div>
            <p style={{ margin: 0, display: "flex", gap: 8, alignItems: "flex-start", ...hint }}>
              <FiRepeat size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              When they sign in they&apos;re asked &ldquo;How do you want to sign in?&rdquo; and choose one. They can switch any time from their name at the top right, without signing in again.
            </p>
          </div>
        ) : (
          <label style={{ ...label, maxWidth: 420 }}>
            Password *
            <span style={{ display: "flex", gap: 8 }}>
              <input type="text" value={form.password} onChange={set("password")} autoComplete="off" placeholder="8 characters or more" style={field} />
              <button type="button" onClick={() => setForm((f) => ({ ...f, password: makePassword() }))} title="Make one up"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px", borderRadius: 10, border: `1.5px solid ${T.tintBorder}`, background: T.tintBg, color: T.accent, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                <FiRefreshCw size={13} /> Generate
              </button>
            </span>
            {form.password && form.password.length < 8 && <span style={{ ...hint, color: "#B91C1C" }}>At least 8 characters.</span>}
            <span style={hint}>Share it with them yourself; they can change it from My Profile.</span>
          </label>
        )}
      </Step>

      <Step n={3} icon={FiUsers} title="The educators they'll look after"
        subtitle="Their claims go to this supervisor first, and their QA visits, training work, parent feedback and check-ins show in the supervisor's portal. You can change this any time.">
        <EducatorPicker options={options} selected={educators} onChange={setEducators} loading={optionsLoading} excludeEmail={ownEmail} />
      </Step>

      {error && <p role="alert" style={{ margin: 0, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, fontWeight: 600 }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => navigate("/supervisors")} style={{ padding: "11px 18px", borderRadius: 11, border: `1.5px solid ${T.border}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button type="submit" disabled={!valid || create.isPending}
          style={{ padding: "11px 20px", borderRadius: 11, border: "none", background: !valid ? "#9CB3C9" : T.accent, color: "#fff", fontWeight: 800, fontSize: 14, cursor: !valid ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {create.isPending ? "Saving…" : `${mode === "existing" ? "Make supervisor" : "Add supervisor"}${educators.size ? ` with ${educators.size} educator${educators.size === 1 ? "" : "s"}` : ""}`}
        </button>
      </div>
    </form>
  );
}
