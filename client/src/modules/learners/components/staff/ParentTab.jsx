import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FiActivity, FiEdit2, FiKey, FiMail, FiPhone, FiUser, FiUsers, FiClipboard } from "react-icons/fi";
import { useAuth } from "../../../../context/AuthContext";
import { learnerApi } from "../../services/learnerApi";
import { activityApi } from "../../../activity/services/activityApi";
import ActivityEntry from "../../../activity/components/ActivityEntry";
import { canSeeRecordHistory } from "../../../activity/components/RecordHistory";
import { learnerPath } from "../../../../routes/portalPaths";
import { T, cardStyle, sectionHeaderStyle, NotOnRecord } from "../../../learner-portal/components/profile/theme";
import { MetaRow } from "../../../learner-portal/components/profile/ProfileIdentityCard";

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null);
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null);
const ago = (v) => {
  if (!v) return null;
  const days = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? "" : "s"} ago`;
};
const ROLE_LABEL = { teacher: "Educator", school: "Learning hub", collaborator: "Staff", supervisor: "Supervisor", hubLead: "Account Manager / Training Lead" };

function Pill({ bg, color, children }) {
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color, whiteSpace: "nowrap" }}>{children}</span>;
}

function Card({ icon: Icon, title, action, children }) {
  return (
    <div style={{ ...cardStyle(), padding: 24, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: T.tintBg, color: T.accentMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} /></div>
          <p style={sectionHeaderStyle()}>{title}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function loginStatus(login) {
  if (!login) return { label: "No login", bg: "#F3F4F6", color: "#6B7280" };
  if (login.deactivatedAt) return { label: "Switched off", bg: "#FEF2F2", color: "#B91C1C" };
  if (!login.lastSignInAt && !login.lastActiveAt) return { label: "Never signed in", bg: "#FFFBEB", color: "#B45309" };
  const days = (Date.now() - new Date(login.lastActiveAt || login.lastSignInAt).getTime()) / 86400000;
  return days > 90 ? { label: "Not used in 3 months", bg: "#FFFBEB", color: "#B45309" } : { label: "Active", bg: "#ECFDF5", color: "#047857" };
}

// What the parent's own login has done — sign-ins included — from the activity log. Only for those
// who may read the log (the workspace owner, and staff whose role grants Activity log → View).
function ParentActivity({ loginId }) {
  const filters = { actor: loginId };
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["activity", "list", filters],
    queryFn: ({ pageParam }) => activityApi.list(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 0,
  });
  const entries = (data?.pages || []).flatMap((page) => page.items);
  return (
    <Card icon={FiActivity} title="Parent's activity">
      <p style={{ margin: "-6px 0 0", fontSize: 12.5, color: T.inkMuted }}>Only what the parent&apos;s own login did — sign-ins, and changes they made. The learner&apos;s own login is in History.</p>
      {isLoading && <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>Loading…</p>}
      {!isLoading && entries.length === 0 && <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>Nothing recorded for this login yet.</p>}
      <div>{entries.map((entry) => <ActivityEntry key={entry.id} entry={entry} compact showDate />)}</div>
      {hasNextPage && (
        <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} style={{ alignSelf: "flex-start", padding: "7px 14px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "#fff", color: T.accent, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          {isFetchingNextPage ? "Loading…" : "Show earlier"}
        </button>
      )}
    </Card>
  );
}

// The staff learner page's Parent tab: everything about the learner's parent, apart from the
// learner — their details (edited with the guardian form), their own login and how it's used, the
// children in the family this viewer may see, what they've signed up for on the website (admins),
// and what their login has done (those who may read the activity log). See learner-parent.service.js.
export default function ParentTab({ learnerId, onEdit }) {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["learners", "parent", learnerId], queryFn: () => learnerApi.parent(learnerId), enabled: !!learnerId });
  const [showAllSignups, setShowAllSignups] = useState(false);

  if (isLoading) return <div style={{ ...cardStyle(), padding: 24, color: T.inkFaint, fontSize: 13 }}>Loading the parent&apos;s details…</div>;
  if (isError) return <div style={{ ...cardStyle(), padding: 24, color: "#B91C1C", fontSize: 13 }}>{error?.message || "Couldn't load the parent's details."}</div>;

  const { details, login, children, hiddenChildren, signups } = data;
  const status = loginStatus(login);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start" }}>
        <Card
          icon={FiUser}
          title="Parent details"
          action={onEdit && (
            <button type="button" onClick={onEdit} aria-label="Edit parent details" title="Edit parent details" style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: T.accent, border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiEdit2 size={12} />
            </button>
          )}
        >
          <MetaRow label="Name" value={details.name || <NotOnRecord />} />
          <MetaRow label="Email" value={details.email ? <a href={`mailto:${details.email}`} style={{ color: T.accentMid, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}><FiMail size={12} />{details.email}</a> : <NotOnRecord />} />
          <MetaRow label="Phone" value={details.phone ? <a href={`tel:${details.phone}`} style={{ color: T.ink, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}><FiPhone size={12} />{details.phone}</a> : <NotOnRecord />} />
        </Card>

        <Card icon={FiKey} title="Parent login" action={<Pill bg={status.bg} color={status.color}>{status.label}</Pill>}>
          {login ? (
            <>
              <MetaRow label="Signs in with" value={login.email} />
              <MetaRow label="Last signed in" value={login.lastSignInAt ? `${fmtDateTime(login.lastSignInAt)} (${ago(login.lastSignInAt)})` : "Never"} />
              <MetaRow label="Last active" value={login.lastActiveAt ? `${fmtDateTime(login.lastActiveAt)} (${ago(login.lastActiveAt)})` : "—"} />
              <MetaRow label="Login made" value={fmtDate(login.createdAt)} />
              {login.otherRoles.length > 0 && <MetaRow label="Same login is also" value={login.otherRoles.map((r) => ROLE_LABEL[r] || r).join(", ")} />}
              {login.deactivatedAt && <p style={{ margin: 0, fontSize: 12.5, color: "#B91C1C" }}>Switched off {fmtDate(login.deactivatedAt)} — the parent can&apos;t sign in.</p>}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>
              {details.email ? "No parent login uses this email yet. Set a password in the parent details to make one." : "There's no parent email on record, so the parent can't have a login. Add one in the parent details."}
            </p>
          )}
        </Card>
      </div>

      <Card icon={FiUsers} title={`Children in this family (${children.length})`}>
        {children.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>No children found under this parent&apos;s email.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {children.map((c) => (
              <Link key={c.id} to={learnerPath(user?.role, c.id, "view")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${c.isThisLearner ? T.accent : "#E5E7EB"}`, background: c.isThisLearner ? T.tintBg : "#fff", textDecoration: "none" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: T.ink }}>{c.name}{c.isThisLearner ? " · this learner" : ""}</span>
                  <span style={{ display: "block", fontSize: 12, color: T.inkFaint, marginTop: 2 }}>{[c.username ? `@${c.username}` : null, c.hubs.join(", ") || null].filter(Boolean).join(" · ") || "No hub yet"}</span>
                </span>
                {c.accountStatus !== "active" && <Pill bg="#FFFBEB" color="#B45309">{c.accountStatus === "pending_payment" ? "Waiting for payment" : c.accountStatus === "inactive" ? "Inactive" : c.accountStatus}</Pill>}
              </Link>
            ))}
          </div>
        )}
        {hiddenChildren > 0 && <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>{hiddenChildren} more {hiddenChildren === 1 ? "child" : "children"} under this email at hubs you don&apos;t see.</p>}
      </Card>

      {signups && (
        <Card icon={FiClipboard} title={`Sign-ups and enquiries (${signups.length})`}>
          {signups.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Nothing from the website under this email.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {(showAllSignups ? signups : signups.slice(0, 8)).map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, border: "1px solid #E5E7EB" }}>
                  <span style={{ minWidth: 0 }}>
                    {s.bootcampId
                      ? <Link to={`/events/bootcamps/${s.bootcampId}/view`} style={{ fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: "none" }}>{s.what}</Link>
                      : <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{s.what}</span>}
                    <span style={{ display: "block", fontSize: 12, color: T.inkFaint, marginTop: 2 }}>
                      {[s.childName ? `For ${s.childName}` : null, s.dates ? `${fmtDate(s.dates.start)} – ${fmtDate(s.dates.end)}` : null, fmtDate(s.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    {s.outcome === "signed_up" ? <Pill bg="#EFF6FF" color="#1D4ED8">Signed up</Pill> : <Pill bg="#F3F4F6" color="#374151">Enquiry</Pill>}
                    {s.paid === true && <Pill bg="#ECFDF5" color="#047857">Paid</Pill>}
                    {s.paid === false && <Pill bg="#FEF2F2" color="#B91C1C">Not paid</Pill>}
                  </span>
                </div>
              ))}
              {signups.length > 8 && (
                <button type="button" onClick={() => setShowAllSignups((v) => !v)} style={{ justifySelf: "start", padding: "7px 14px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "#fff", color: T.accent, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  {showAllSignups ? "Show the latest 8" : `Show all ${signups.length}`}
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      {login && canSeeRecordHistory(user) && <ParentActivity loginId={login.id} />}
    </div>
  );
}
