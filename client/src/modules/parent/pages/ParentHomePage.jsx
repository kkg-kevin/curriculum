import { Link, useOutletContext } from "react-router-dom";
import { FiAlertCircle, FiAward, FiCalendar, FiCheckCircle, FiChevronRight, FiClipboard, FiCreditCard, FiFileText, FiKey, FiUserCheck } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { T, cardStyle } from "../../learner-portal/components/profile/theme";
import { childColor } from "../components/childColors";
import { childPath } from "../parentPaths";
import { JoinOnlineButton, isLive } from "../../timetable/components/OnlineClass";
import { formatDay, formatMoney, plural, relativeDay } from "../format";

function SummaryPill({ icon, value, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", minWidth: 150 }}>
      <span style={{ color: "#feb139", display: "flex", fontSize: 18 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)" }}>{label}</div>
      </div>
    </div>
  );
}

// What needs the parent right now, across every child and the family's bills.
function attentionItems(children, billing) {
  const items = [];
  children.forEach((child) => {
    if (child.work.overdueCount > 0) {
      items.push({ key: `${child.id}-overdue`, tone: "red", icon: <FiClipboard />, text: `${child.firstName} has ${plural(child.work.overdueCount, "piece")} of work past the due date`, to: childPath(child.id) });
    }
    child.diagnosticsWaiting.forEach((d) => {
      items.push({ key: `${child.id}-${d.issueId}`, tone: "amber", icon: <FiAlertCircle />, text: `${child.firstName} hasn't taken the placement test "${d.name}" yet — they do it on their own login`, to: childPath(child.id, "/login") });
    });
    if (!child.hasOwnLogin) {
      items.push({ key: `${child.id}-login`, tone: "blue", icon: <FiKey />, text: `${child.firstName} has no login of their own yet — set one up so they can do their work`, to: childPath(child.id, "/login") });
    }
  });
  if (billing?.next) {
    items.push({
      key: "invoice",
      tone: "amber",
      icon: <FiCreditCard />,
      text: `${formatMoney(billing.next.amountDue, billing.currency)} to pay on ${billing.next.invoiceNumber}${billing.next.dueAt ? ` (due ${formatDay(billing.next.dueAt)})` : ""}`,
      to: `/parent/invoices/${billing.next.id}`,
    });
  }
  return items;
}

const TONES = {
  red: { bg: "#FEF2F2", border: "#FECACA", color: "#B91C1C" },
  amber: { bg: "#FFFBEB", border: "#FDE68A", color: "#B45309" },
  blue: { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8" },
};

function Fact({ icon, label, children }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: T.inkMuted }}>
      <span style={{ color: T.accentMid, display: "flex", marginTop: 2 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ color: T.ink, fontWeight: 600, marginTop: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function ChildCard({ child, index }) {
  const color = childColor(index);
  const hub = child.hubs[0];
  const result = child.work.results[0];
  return (
    <div style={{ ...cardStyle({ padding: 0, overflow: "hidden" }), display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar firstName={child.firstName} lastName={child.lastName} photo={child.photo} size={52} borderColor={color} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>{child.firstName} {child.lastName}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>
              {hub ? `${hub.name}${hub.className ? ` · ${hub.className}` : ""}` : "Not enrolled at a hub yet"}
              {child.hubs.length > 1 ? ` · +${child.hubs.length - 1} more` : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <Fact icon={<FiClipboard />} label="Work to do">
            {child.work.dueCount === 0 ? "All done" : plural(child.work.dueCount, "piece")}
            {child.work.overdueCount > 0 && <span style={{ color: "#B91C1C" }}> · {child.work.overdueCount} overdue</span>}
          </Fact>
          <Fact icon={<FiCheckCircle />} label="Latest result">
            {result ? `${result.name}${result.percent != null ? ` — ${result.percent}%` : ""}` : "None yet"}
          </Fact>
          <Fact icon={<FiCalendar />} label="Next session">
            {child.nextSession
              ? `${relativeDay(child.nextSession.date)}${child.nextSession.startTime ? `, ${child.nextSession.startTime.slice(0, 5)}` : ""}${child.nextSession.courseName ? ` · ${child.nextSession.courseName}` : ""}`
              : "Nothing in the next 2 weeks"}
            {child.nextSession?.meetingLink && (
              <div style={{ marginTop: 6 }}>
                <JoinOnlineButton href={child.nextSession.meetingLink} live={isLive(child.nextSession)} size="sm" label="Join online class" />
              </div>
            )}
          </Fact>
          <Fact icon={<FiUserCheck />} label="Attendance (30 days)">
            {child.attendance ? `${child.attendance.percent}% of ${plural(child.attendance.sessions, "session")}` : "Not recorded yet"}
          </Fact>
          <Fact icon={<FiFileText />} label="Latest report">
            {child.latestReport ? `${child.latestReport.courseName || "Report"}${child.latestReport.final ? " (final)" : ""} · ${formatDay(String(child.latestReport.publishedAt || "").slice(0, 10))}` : "None yet"}
          </Fact>
          <Fact icon={<FiAward />} label="Certificates">
            {child.certificateCount ? plural(child.certificateCount, "certificate") : "None yet"}
          </Fact>
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to={childPath(child.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            Open {child.firstName}&apos;s profile <FiChevronRight />
          </Link>
          <Link to={childPath(child.id, "/login")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`, color: T.accent, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            <FiKey /> Login
          </Link>
        </div>
      </div>
    </div>
  );
}

// The parent's home: every child at a glance, and what needs the parent's attention.
export default function ParentHomePage() {
  const { overview, children, overviewLoading } = useOutletContext();

  if (overviewLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading your family…</div>;
  }

  const billing = overview?.billing;
  const parentFirstName = (overview?.parent?.name || "").trim().split(/\s+/)[0];
  const dueTotal = children.reduce((sum, c) => sum + c.work.dueCount, 0);
  const attention = attentionItems(children, billing);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 45%, ${T.accentMid} 100%)`, borderRadius: 20, padding: "26px 30px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -50, right: -30, width: 200, height: 200, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>
          {parentFirstName ? `Hello, ${parentFirstName}` : "Hello"}
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "rgba(255,255,255,0.75)" }}>
          {children.length === 1 ? `Here's how ${children[0].firstName} is doing.` : "Here's how your family is doing."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SummaryPill icon={<FiUserCheck />} value={children.length} label={children.length === 1 ? "child" : "children"} />
          <SummaryPill icon={<FiClipboard />} value={dueTotal} label="pieces of work to do" />
          <SummaryPill icon={<FiCreditCard />} value={billing?.openCount ? formatMoney(billing.amountDue, billing.currency) : "Nothing"} label={billing?.openCount ? `to pay · ${plural(billing.openCount, "invoice")}` : "to pay"} />
        </div>
      </div>

      <div style={{ ...cardStyle({ padding: "18px 20px" }) }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: T.ink }}>Needs your attention</h2>
        {attention.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: T.inkMuted }}>Nothing needs you right now.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attention.map((item) => {
              const tone = TONES[item.tone];
              return (
                <Link key={item.key} to={item.to} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
                  <span style={{ display: "flex", flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.text}</span>
                  <FiChevronRight style={{ flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {children.length === 0 ? (
        <div style={{ ...cardStyle({ padding: "40px 24px", textAlign: "center" }) }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, color: T.ink }}>No children linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your children appear here once their hub adds them with this email address.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
          {children.map((child, index) => <ChildCard key={child.id} child={child} index={index} />)}
        </div>
      )}
    </div>
  );
}
