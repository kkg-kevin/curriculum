import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiCalendar, FiMapPin, FiPlus, FiUsers } from "react-icons/fi";
import { BRAND, FONT } from "../../../theme/brand";
import { usePermissions } from "../../../hooks/usePermissions";
import { useGeneralEventsQuery } from "../hooks/useGeneralEvents";
import { EVENTS_CSS, StatePill, btn, plural } from "../shared";

// Events page → General events: events anyone can come to (showcases, open days, talks) — on the
// website with a pop-up, and a pop-up for everyone signed in (modules/general-events/).
const FILTERS = [
  { key: "coming", label: "Coming up", test: (e) => ["upcoming", "on_now", "draft"].includes(e.state) },
  { key: "past", label: "Past", test: (e) => e.state === "ended" },
  { key: "cancelled", label: "Cancelled", test: (e) => e.state === "cancelled" },
  { key: "all", label: "All", test: () => true },
];

function EventCard({ event, onOpen }) {
  const full = event.capacity && event.people >= event.capacity;
  return (
    <button type="button" onClick={onOpen} style={{ textAlign: "left", background: "#fff", borderRadius: 16, padding: 0, border: `1.5px solid ${BRAND.border}`, cursor: "pointer", fontFamily: FONT, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ height: 96, position: "relative", background: event.coverImage ? `center / cover no-repeat url(${event.coverImage})` : "linear-gradient(135deg, #1a3550, #2e7db5)", filter: event.state === "draft" || event.state === "cancelled" ? "grayscale(0.6) brightness(0.92)" : "none" }}>
        <StatePill state={event.state} style={{ position: "absolute", top: 10, right: 10 }} />
      </div>
      <div style={{ padding: "14px 16px", display: "grid", gap: 7, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.ink, lineHeight: 1.35 }}>{event.title}</h3>
        <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: BRAND.muted }}><FiCalendar size={13} /> {event.when}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: BRAND.muted, minWidth: 0 }}><FiMapPin size={13} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.where}</span></span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, fontWeight: 700, color: full ? BRAND.goldText : BRAND.navy, marginTop: "auto" }}>
          <FiUsers size={13} /> {event.capacity ? `${event.people} of ${event.capacity} places` : plural(event.people, "person", "people")}
          {event.waitlisted > 0 && <span style={{ color: BRAND.goldText }}>· {event.waitlisted} waiting</span>}
        </span>
      </div>
    </button>
  );
}

export default function GeneralEventsSection() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { data: events = [], isLoading, isError, error } = useGeneralEventsQuery();
  const [filter, setFilter] = useState("coming");
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    const list = events.filter(f.test);
    return filter === "coming" ? [...list].sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`)) : list;
  }, [events, filter]);
  const canCreate = can("general-events", "create");

  return (
    <div>
      <style>{EVENTS_CSS}</style>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: "0 0 3px", fontSize: 17, fontWeight: 800, color: BRAND.ink }}>General events</h2>
          <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5, maxWidth: 620 }}>
            Events anyone can come to — a bootcamp showcase, an open day, a talk. They&rsquo;re on the website with a pop-up, everyone signed in sees a pop-up, and every person who registers lands in Enquiries.
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => navigate("/events/general/create")} style={btn("gold", { boxShadow: "0 2px 8px rgba(254,177,57,0.35)" })}>
            <FiPlus size={14} /> New event
          </button>
        )}
      </div>

      {events.length > 0 && (
        <div className="ge-row" style={{ marginBottom: 14 }} role="group" aria-label="Show">
          {FILTERS.map((f) => {
            const count = events.filter(f.test).length;
            return (
              <button key={f.key} type="button" className="ge-chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} <span style={{ opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Loading events…</p>
      ) : isError ? (
        <div style={{ padding: "14px 18px", borderRadius: 12, background: BRAND.dangerTint, border: `1px solid ${BRAND.dangerBorder}`, color: BRAND.danger, fontSize: 13.5, display: "flex", gap: 8, alignItems: "center" }}>
          <FiAlertTriangle size={15} /> Couldn&rsquo;t load events: {error?.response?.data?.message || error?.message}
        </div>
      ) : events.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 14, border: `1.5px dashed ${BRAND.border}`, background: "#F9FAFB" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: BRAND.skyTint, border: `1.5px solid ${BRAND.skyBorder}`, display: "flex", alignItems: "center", justifyContent: "center", color: BRAND.navy, flexShrink: 0 }}>
            <FiCalendar size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: BRAND.inkSoft }}>No general events yet</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: BRAND.muted, lineHeight: 1.55 }}>
              Make one for your next showcase or open day — people register on the website or from the pop-up.
            </p>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Nothing here.</p>
      ) : (
        <div className="ge-cards">
          {shown.map((e) => <EventCard key={e.id} event={e} onOpen={() => navigate(`/events/general/${e.id}`)} />)}
        </div>
      )}
    </div>
  );
}
