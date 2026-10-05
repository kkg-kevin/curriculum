import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle, FiChevronRight, FiClock, FiLayers, FiSearch, FiTrendingUp, FiX } from "react-icons/fi";
import { useMyClaimCourses } from "../../claims/hooks/useClaims";
import { CourseStagePill, LocationChip, ProgressBar, T, cardStyle, formatMoney } from "../../claims/shared";

// My Claims — every course the educator teaches, what each is worth, and where its payment
// stands. A course opens onto its sessions and the payment request itself (ClaimCoursePage).
// Spans every hub the educator teaches at, Home Learning included: pay is per course, not per hub.

const FILTERS = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready to claim" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "in_progress", label: "In progress" },
  { key: "not_started", label: "Not started" },
];

// Ways to order the list. "Needs action" puts what the educator can act on, or is waiting to
// hear about, ahead of courses that are still running or already settled.
const SORTS = [
  { key: "action", label: "Needs action first" },
  { key: "name", label: "Course name (A–Z)" },
  { key: "progress", label: "Most sessions delivered" },
  { key: "amount", label: "Highest amount" },
];
const STAGE_ORDER = ["ready", "in_review", "approved", "in_progress", "not_started", "paid"];
const progressOf = (course) => (course.sessionsTotal > 0 ? course.sessionsDelivered / course.sessionsTotal : 0);
const SORTERS = {
  action: (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || progressOf(b) - progressOf(a) || a.courseName.localeCompare(b.courseName),
  name: (a, b) => a.courseName.localeCompare(b.courseName) || (a.className || "").localeCompare(b.className || ""),
  progress: (a, b) => progressOf(b) - progressOf(a) || a.courseName.localeCompare(b.courseName),
  amount: (a, b) => b.courseAmount - a.courseAmount || a.courseName.localeCompare(b.courseName),
};

const selectStyle = { padding: "9px 30px 9px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, background: "#fff", outline: "none", cursor: "pointer", maxWidth: "100%", minWidth: 0 };

function StatCard({ icon: Icon, tone, value, label, sub }) {
  return (
    <div style={{ ...cardStyle, padding: "18px 20px" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: tone.bg, color: tone.color, display: "grid", placeItems: "center" }}><Icon size={18} /></div>
      <p style={{ margin: "14px 0 0", fontSize: 22, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.3px" }}>{value}</p>
      <p style={{ margin: "3px 0 0", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontSize: 12, color: T.inkFaint }}>{sub}</p>
    </div>
  );
}

function CourseCard({ course, onOpen }) {
  const money = (value) => formatMoney(value, course.currency);
  const percent = course.sessionsTotal > 0 ? Math.round((course.sessionsDelivered / course.sessionsTotal) * 100) : 0;
  const declined = course.latestClaim?.status === "rejected";
  return (
    <button type="button" onClick={onOpen} className="claim-course-card" style={{ ...cardStyle, padding: 18, textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.courseName}</p>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.className || "Class"}</p>
        </div>
        <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#F1F5F9", color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><FiChevronRight size={16} /></span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "#F5F8FB", minWidth: 0 }}>
        <LocationChip hub={course.hub} />
        <span style={{ fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.hub?.name || "No hub"}</span>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>Sessions</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{course.sessionsDelivered}/{course.sessionsTotal}</span>
        </div>
        <ProgressBar percent={percent} />
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <CourseStagePill stage={course.stage} size="small" />
          {declined && <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>Last claim declined</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>Amount payable</p>
          <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{money(course.courseAmount)}</p>
        </div>
      </div>
    </button>
  );
}

export default function ClaimsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useMyClaimCourses();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hubId, setHubId] = useState("all");
  const [place, setPlace] = useState("all"); // all | home | hub
  const [sort, setSort] = useState("action");

  const courses = useMemo(() => data?.courses || [], [data]);
  // The hubs these courses are taught at, for the hub filter — offered only when there's a choice.
  const hubs = useMemo(() => {
    const byId = new Map();
    for (const course of courses) {
      if (!course.hub) continue;
      const entry = byId.get(course.hub.id) || { id: course.hub.id, name: course.hub.name, count: 0 };
      entry.count += 1;
      byId.set(course.hub.id, entry);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [courses]);
  const homeCount = useMemo(() => courses.filter((c) => c.hub?.isHomeLearning).length, [courses]);
  const hasBothPlaces = homeCount > 0 && homeCount < courses.length;

  // Everything but the status: the status pills count within this, so each pill's number is
  // what choosing it would actually show.
  const scoped = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return courses
      .filter((c) => hubId === "all" || c.hub?.id === hubId)
      .filter((c) => place === "all" || (place === "home") === Boolean(c.hub?.isHomeLearning))
      .filter((c) => {
        if (!words.length) return true;
        const text = [c.courseName, c.className, c.hub?.name, c.academicYear].filter(Boolean).join(" ").toLowerCase();
        return words.every((word) => text.includes(word));
      });
  }, [courses, hubId, place, search]);
  const counts = useMemo(() => {
    const result = { all: scoped.length };
    for (const course of scoped) result[course.stage] = (result[course.stage] || 0) + 1;
    return result;
  }, [scoped]);
  const visible = useMemo(
    () => scoped.filter((c) => filter === "all" || c.stage === filter).sort(SORTERS[sort]),
    [scoped, filter, sort]
  );
  const filtering = filter !== "all" || hubId !== "all" || place !== "all" || search.trim() !== "";
  const clearFilters = () => { setFilter("all"); setHubId("all"); setPlace("all"); setSearch(""); };

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading your claims…</p>;
  if (isError) {
    return (
      <div style={{ ...cardStyle, fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Your claims couldn't be loaded</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
      </div>
    );
  }

  const { summary, currency } = data;
  const money = (value) => formatMoney(value, currency);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>My Claims</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>Track payments for your teaching sessions, and request an advance or full payment for a course.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        <StatCard icon={FiTrendingUp} tone={{ bg: T.tintBg, color: T.accent }} value={money(summary.totalValue)} label="Total claimable" sub={`${summary.courses} ${summary.courses === 1 ? "course" : "courses"} · ${money(summary.earned)} earned so far`} />
        <StatCard icon={FiAlertCircle} tone={{ bg: "#FFF7ED", color: "#EA580C" }} value={money(summary.inReview + summary.awaitingPayment)} label="Outstanding" sub={`${summary.inReviewCount} in review · ${summary.awaitingPaymentCount} approved, awaiting payment`} />
        <StatCard icon={FiCheckCircle} tone={{ bg: "#ECFDF5", color: "#16A34A" }} value={money(summary.paid)} label="Paid" sub={`${summary.paidCount} ${summary.paidCount === 1 ? "claim" : "claims"} · advances ${money(summary.advancePaid)}`} />
        <StatCard icon={FiClock} tone={{ bg: "#EFF6FF", color: "#2563EB" }} value={`${summary.hours} hrs`} label="Time tracked" sub={`${summary.sessionsDelivered} ${summary.sessionsDelivered === 1 ? "session" : "sessions"} delivered`} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.filter((f) => f.key === "all" || f.key === filter || counts[f.key]).map((f) => {
            const active = filter === f.key;
            return (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)} style={{ padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", border: `1.5px solid ${active ? T.accent : T.border}`, background: active ? T.accent : "#fff", color: active ? "#fff" : T.inkMuted }}>
                {f.label} <span style={{ opacity: 0.75 }}>({counts[f.key] || 0})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
          <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by course, class or hub…" aria-label="Search courses" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" }} />
        </div>
        {hubs.length > 1 && (
          <select value={hubId} onChange={(e) => setHubId(e.target.value)} aria-label="Filter by hub" style={{ ...selectStyle, borderColor: hubId !== "all" ? T.accent : T.border }}>
            <option value="all">All hubs ({courses.length})</option>
            {hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name} ({hub.count})</option>)}
          </select>
        )}
        {hasBothPlaces && (
          <select value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Filter by where the course is taught" style={{ ...selectStyle, borderColor: place !== "all" ? T.accent : T.border }}>
            <option value="all">Home and hub</option>
            <option value="home">Home learning ({homeCount})</option>
            <option value="hub">At a hub ({courses.length - homeCount})</option>
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort courses" style={selectStyle}>
          {SORTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </div>

      {courses.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: -6, minHeight: 22 }}>
          <span style={{ fontSize: 12.5, color: T.inkMuted }}>
            {filtering ? `Showing ${visible.length} of ${courses.length} courses` : `${courses.length} ${courses.length === 1 ? "course" : "courses"}`}
          </span>
          {filtering && (
            <button type="button" onClick={clearFilters} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: "none", background: "none", color: T.accentMid, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              <FiX size={13} /> Clear filters
            </button>
          )}
        </div>
      )}

      {courses.length === 0 ? (
        <div style={{ ...cardStyle, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><FiLayers size={24} /></div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink }}>You aren't teaching any courses yet</p>
          <p style={{ margin: "6px auto 0", maxWidth: 420, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>Once you're assigned to a course in a class, it shows here with what it pays and where its claim stands.</p>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>No courses match</p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>No course fits every filter you've set. <button type="button" onClick={clearFilters} style={{ padding: 0, border: "none", background: "none", color: T.accentMid, fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear filters</button></p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {visible.map((course) => (
            <CourseCard key={`${course.classId}:${course.courseId}`} course={course} onOpen={() => navigate(`/teacher-portal/claims/${course.classId}/${course.courseId}`)} />
          ))}
        </div>
      )}

      <style>{`
        .claim-course-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .claim-course-card:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(37,71,106,0.12); }
        .claim-course-card:focus-visible { outline: 2px solid ${T.accentLight}; outline-offset: 2px; }
      `}</style>
    </div>
  );
}
