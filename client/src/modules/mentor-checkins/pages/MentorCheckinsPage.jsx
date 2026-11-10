import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiCalendar, FiClipboard, FiFileText, FiLayers, FiMapPin, FiPlus, FiVideo } from "react-icons/fi";
import { usePermissions } from "../../../hooks/usePermissions";
import { useMeetings, useRounds } from "../hooks/useMentorCheckins";
import MeetingList from "../components/MeetingList";
// Templates are QA's own screen, saving to parent–mentor check-ins (qa/templateSources.js).
import TemplatesTab from "../../qa/components/TemplatesTab";
import { CheckinStyles, Empty, FORMAT_LABEL, Pill, Segmented, T, Tabs, btn, card, font, formatDate, hint, toolbar, useMentorBase } from "../shared";

const VIEWER_OF_BASE = {
  "/mentor-checkins": "manager",
  "/teacher-portal/mentor-checkins": "educator",
  "/parent/mentor-checkins": "parent",
  "/school-portal/mentor-checkins": "hub",
  "/supervisor-portal/mentor-checkins": "supervisor",
};

const INTRO = {
  manager: "One-to-one check-ins between a class's educators and each family about how their child is doing. Pick a class, and the times are drawn at random for its families — at least 3 days ahead. The educators and parents take it from there.",
  educator: "Your check-ins with the families of your classes, one at a time. After each, write a short report — the parent reads it and approves it.",
  parent: "One-to-one talks with your child's mentor about how they're doing. Confirm your time or pick another that suits you; afterwards, read the mentor's report and approve it.",
  hub: "When your classes' educators are meeting each family, and where each check-in stands.",
  supervisor: "When your educators are meeting their classes' families, and where each check-in stands.",
};

// One round: a class's check-ins.
function RoundRow({ round, base }) {
  const c = round.counts;
  return (
    <Link to={`${base}/rounds/${round.id}`} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "14px 18px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: "inherit" }}>
      <div style={{ flex: "1 1 300px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14, color: T.ink }}>{round.className}</strong>
          <span style={{ fontSize: 13, color: T.inkMuted }}>{round.hubName}</span>
          <Pill look={{ bg: "#F3F4F6", color: "#374151" }}>{round.format === "online" ? <><FiVideo size={11} /> {FORMAT_LABEL.online}</> : <><FiMapPin size={11} /> {round.location || FORMAT_LABEL.in_person}</>}</Pill>
          {round.templateName && <Pill look={{ bg: "#F5F3FF", color: "#6D28D9" }}>{round.templateName}</Pill>}
          {round.status === "cancelled" && <Pill look={{ bg: "#FEF2F2", color: "#B91C1C" }}>Cancelled</Pill>}
        </div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: T.inkMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span><FiCalendar size={12} style={{ verticalAlign: -1 }} /> {formatDate(round.windowStart, { day: "numeric", month: "short" })} – {formatDate(round.windowEnd, { day: "numeric", month: "short", year: "numeric" })}</span>
          <span>{round.educatorNames.join(", ") || "No educators"}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
        <Pill look={{ bg: "#EFF6FF", color: "#1D4ED8" }}>{c.total} famil{c.total === 1 ? "y" : "ies"}</Pill>
        {c.upcoming > 0 && <Pill look={{ bg: "#F0F9FF", color: "#075985" }}>{c.upcoming} coming · {c.confirmed} confirmed</Pill>}
        {c.reportDue > 0 && <Pill look={{ bg: "#FFFBEB", color: "#B45309" }}>{c.reportDue} report{c.reportDue === 1 ? "" : "s"} due</Pill>}
        {c.awaitingApproval > 0 && <Pill look={{ bg: "#F5F3FF", color: "#6D28D9" }}>{c.awaitingApproval} with parents</Pill>}
        {c.approved > 0 && <Pill look={{ bg: "#ECFDF5", color: "#047857" }}>{c.approved} approved</Pill>}
        {c.missed > 0 && <Pill look={{ bg: "#FEF2F2", color: "#B91C1C" }}>{c.missed} missed</Pill>}
      </div>
    </Link>
  );
}

function RoundsTab({ base, canManage }) {
  const [status, setStatus] = useState("published");
  const navigate = useNavigate();
  const { data = [], isLoading, isError, error } = useRounds({ status });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}>
        <Segmented label="Show" options={[{ key: "published", label: "Active" }, { key: "cancelled", label: "Cancelled" }]} value={status} onChange={setStatus} />
        {canManage && <button type="button" className="ci-btn" onClick={() => navigate(`${base}/rounds/new`)} style={btn("primary")}><FiPlus size={15} /> Set up check-ins</button>}
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "The check-ins couldn't be loaded."}</p>}
        {!isLoading && !isError && data.length === 0 && (
          <Empty title={status === "published" ? "No parent check-ins set up" : "Nothing cancelled"}>
            {status === "published" && canManage ? "Set up check-ins for a class — its families get their times at random." : null}
          </Empty>
        )}
        {data.map((r) => <RoundRow key={r.id} round={r} base={base} />)}
      </section>
    </div>
  );
}

function MeetingsTab({ base, viewer, roundId }) {
  const [view, setView] = useState("coming");
  const { data, isLoading, isError, error } = useMeetings({ view, ...(roundId ? { roundId } : {}) });
  const counts = data?.counts || {};
  const todoLabel = viewer === "parent" ? "To approve" : viewer === "educator" ? "Reports to write" : "Report due";
  const options = [
    { key: "coming", label: `Coming up${counts.coming ? ` (${counts.coming})` : ""}` },
    { key: "todo", label: `${todoLabel}${counts.todo ? ` (${counts.todo})` : ""}` },
    { key: "done", label: "Done" },
    { key: "all", label: "All" },
  ];
  const empty = {
    coming: viewer === "parent" ? "No check-ins coming up" : "Nothing coming up",
    todo: viewer === "parent" ? "No reports waiting for you" : "No reports waiting",
    done: "Nothing finished yet",
    all: "No check-ins yet",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}><Segmented label="Show" options={options} value={view} onChange={setView} /></div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "The check-ins couldn't be loaded."}</p>}
        {!isLoading && !isError && <MeetingList meetings={data?.meetings || []} viewer={viewer} base={base} emptyTitle={empty[view]} />}
      </section>
    </div>
  );
}

// Parent–mentor check-ins. The admin app: every class's rounds (set one up, open its schedule)
// and the templates. The teacher, hub and supervisor portals: their check-ins one by one, and by
// class. The parent portal: their own check-ins. ?tab= picks the tab; ?round= narrows the list.
export default function MentorCheckinsPage() {
  const base = useMentorBase();
  const viewer = VIEWER_OF_BASE[base] || "manager";
  const { can } = usePermissions();
  const canManage = viewer === "manager" && (can("mentor-checkins", "create") || can("mentor-checkins", "edit"));
  const [params, setParams] = useSearchParams();
  const roundId = params.get("round") || undefined;
  const tabs = viewer === "manager"
    ? [{ key: "rounds", label: "Schedules", icon: FiCalendar }, { key: "templates", label: "Templates", icon: FiFileText }]
    : viewer === "parent"
    ? []
    : [{ key: "mine", label: "Check-ins", icon: FiClipboard }, { key: "classes", label: "By class", icon: FiLayers }];
  const fallback = tabs[0]?.key;
  const tab = tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : fallback;
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === fallback) next.delete("tab"); else next.set("tab", key);
    next.delete("round");
    setParams(next);
  };

  return (
    <div style={{ fontFamily: font }}>
      <CheckinStyles />
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "26px 30px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>{viewer === "parent" ? "Mentor Check-ins" : "Parent–Mentor Check-ins"}</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.5, maxWidth: 680 }}>{INTRO[viewer]}</p>
      </div>

      {tabs.length > 0 && <div style={{ marginBottom: 16 }}><Tabs tabs={tabs} value={tab} onChange={setTab} label="Parent–mentor check-ins" /></div>}

      {viewer === "manager" ? (
        <>
          {tab === "rounds" && <RoundsTab base={base} canManage={canManage} />}
          {tab === "templates" && <TemplatesTab source="mentor" />}
        </>
      ) : viewer === "parent" || tab === "mine" ? (
        <>
          {roundId && (
            <p style={{ ...hint, fontSize: 13, margin: "0 0 10px" }}>
              Showing one class&apos;s check-ins. <button type="button" onClick={() => setTab("mine")} style={{ border: 0, background: "none", padding: 0, color: T.accentMid, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Show all</button>
            </p>
          )}
          <MeetingsTab key={roundId || "all"} base={base} viewer={viewer} roundId={roundId} />
        </>
      ) : (
        <RoundsTab base={base} canManage={false} />
      )}
    </div>
  );
}
