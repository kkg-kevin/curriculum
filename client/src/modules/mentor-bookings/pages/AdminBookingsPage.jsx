import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiCalendar, FiHome, FiRotateCcw, FiSearch } from "react-icons/fi";
import { Tabs } from "../../../components/ui/TabBar";
import { usePermissions } from "../../../hooks/usePermissions";
import { useAuth } from "../../../context/AuthContext";
import HubStatement from "../components/HubStatement";
import { useBookings, usePartnerHubs } from "../hooks/useMentorBookings";
import { BookingRow, EmptyNote, RowStyles, ksh, splitBookings } from "../shared";
import { BRAND, FONT, HERO_GRADIENT, card, pill } from "../../../theme/brand";

// Mentor bookings for the workspace (admin app, /mentor-bookings — Finance; staff module
// "mentor-bookings"):
//   Bookings         every family's booking of a mentor — search, filter by state
//   Refunds          cancelled after payment: give the money back, then mark it refunded
//   Hub settlements  partner hubs' desk fees (option C): what each is owed, its statement, settle
// The rates and rules are in Settings → Educator Pay → Mentor bookings.

const TABS = [
  { key: "bookings", label: "Bookings", icon: FiCalendar },
  { key: "refunds", label: "Refunds", icon: FiRotateCcw },
  { key: "hubs", label: "Hub settlements", icon: FiHome },
];
const FILTERS = [["all", "All"], ["coming", "Coming up"], ["to_mark", "To mark"], ["held", "Waiting for payment"], ["done", "Held"], ["cancelled", "Cancelled"]];
const control = { padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13, fontFamily: FONT, background: "#fff", minWidth: 0 };

function BookingsTab() {
  const { data = [], isLoading } = useBookings();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((b) => {
      if (filter === "coming" && !["confirmed", "today"].includes(b.state)) return false;
      if (filter === "to_mark" && b.state !== "to_mark") return false;
      if (filter === "held" && b.state !== "held") return false;
      if (filter === "done" && !["completed", "no_show"].includes(b.state)) return false;
      if (filter === "cancelled" && b.state !== "cancelled") return false;
      return !term || [b.mentor?.name, b.learner?.name, b.courseName, b.sessionTitle, b.hubName].filter(Boolean).some((x) => x.toLowerCase().includes(term));
    });
  }, [data, filter, q]);
  const { coming, past } = splitBookings(data);
  const paid = data.filter((b) => ["confirmed", "completed", "no_show"].includes(b.status)).reduce((n, b) => n + (b.invoice?.amountPaid || 0), 0);
  const tiles = [["Coming up", coming.filter((b) => b.state !== "held").length], ["To mark", data.filter((b) => b.state === "to_mark").length], ["Held", past.filter((b) => b.status === "completed").length], ["Paid in", ksh(paid)]];
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {tiles.map(([t, v]) => <div key={t} style={{ ...card, flex: "1 1 150px", padding: "13px 16px" }}><p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: BRAND.muted }}>{t}</p><p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 900, color: BRAND.ink }}>{v}</p></div>)}
      </div>
      <div style={{ ...card, padding: "10px 12px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: 8, ...control }}>
          <FiSearch color={BRAND.faint} />
          <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mentor, learner, course or hub…" style={{ border: "none", outline: "none", width: "100%", fontSize: 13, fontFamily: FONT }} />
        </label>
        <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)} style={control}>
          {FILTERS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: BRAND.faint }}>{isLoading ? "Loading…" : `${shown.length} booking${shown.length === 1 ? "" : "s"}`}</span>
      </div>
      {!isLoading && !shown.length ? <EmptyNote title={data.length ? "Nothing matches" : "No bookings yet"} line={data.length ? "Try another filter." : "Families book mentors from the parent portal once Settings → Educator Pay → Mentor bookings is switched on."} />
        : <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{shown.map((b) => <BookingRow key={b.id} booking={b} base="/mentor-bookings" show="both" />)}</div>}
    </div>
  );
}

function RefundsTab() {
  const { data = [], isLoading } = useBookings({ refunds: 1 });
  const due = data.filter((b) => b.refundStatus === "due");
  const done = data.filter((b) => b.refundStatus === "refunded");
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Sessions cancelled after they were paid for. Give the family their money back, then open the booking and mark it refunded.</p>
      {isLoading ? <p style={{ margin: 0, color: BRAND.faint }}>Loading…</p> : !due.length ? <EmptyNote title="No refunds due" /> : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
          {due.map((b) => <div key={b.id} style={{ display: "grid", gap: 4, gridTemplateColumns: "100%" }}><BookingRow booking={b} base="/mentor-bookings" show="both" /><span style={{ ...pill("danger"), alignSelf: "flex-start", justifySelf: "start" }}><FiAlertCircle size={11} /> {ksh(b.refundAmount)} to refund</span></div>)}
        </div>
      )}
      {done.length > 0 && (
        <>
          <h3 style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Refunded</h3>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{done.map((b) => <BookingRow key={b.id} booking={b} base="/mentor-bookings" show="both" />)}</div>
        </>
      )}
    </div>
  );
}

function HubsTab({ canSettle }) {
  const [params, setParams] = useSearchParams();
  const { data: hubs = [], isLoading } = usePartnerHubs();
  const hubId = params.get("hub") || "";
  const choose = (id) => { const next = new URLSearchParams(params); if (id) next.set("hub", id); else next.delete("hub"); setParams(next, { replace: true }); };
  if (hubId) return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
      <button type="button" onClick={() => choose("")} style={{ justifySelf: "start", border: "none", background: "none", color: BRAND.mid, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT, padding: 0 }}>← Every hub</button>
      <HubStatement hubId={hubId} canSettle={canSettle} />
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
      <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.55 }}>When a family books a mentor at a hub&apos;s space, the space fee is on their invoice and we collect it. A partner hub (set on the hub form: &quot;Desk fees from mentor sessions&quot;) is owed its share once the session has happened.</p>
      {isLoading ? <p style={{ margin: 0, color: BRAND.faint }}>Loading…</p> : !hubs.length ? <EmptyNote title="No partner hubs" line="Mark a hub as a partner on its form to collect its desk fees for it." /> : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
          {hubs.map((h) => (
            <button key={h.id} type="button" onClick={() => choose(h.id)} className="mb-row" style={{ ...card, textAlign: "left", padding: "14px 16px", cursor: "pointer", fontFamily: FONT, border: "none" }}>
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{h.name}</p>
              <p style={{ margin: "2px 0 8px", fontSize: 12, color: BRAND.muted }}>{h.deskFeeOwner === "hub" ? `Partner · we keep ${h.deskCollectionPercent}%` : "Our own hub"}</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: h.owed ? BRAND.navy : BRAND.faint }}>{ksh(h.owed)} <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.muted }}>owed now</span></p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: BRAND.faint }}>{h.upcoming ? `${ksh(h.upcoming)} coming · ` : ""}{h.lastSettled ? `last settled ${new Date(h.lastSettled.at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}` : "never settled"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminBookingsPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canManage = user?.role === "admin" || can("mentor-bookings", "edit");
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "bookings";
  const setTab = (key) => { const next = new URLSearchParams(); if (key !== "bookings") next.set("tab", key); setParams(next, { replace: true }); };
  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 16 }}>
      <RowStyles />
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "22px 26px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Mentor bookings</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 680, lineHeight: 1.6 }}>Families book a mentor when their child is stuck — paid first, online or at a hub. Rates: Settings → Educator Pay.</p>
      </div>
      <div className="pp-tabs"><style>{"@media (max-width: 640px) { .pp-tabs .ui-tab-scroll { flex-wrap: wrap; overflow-x: visible !important; width: 100% !important; } }"}</style><Tabs label="Mentor bookings" tabs={TABS} value={tab} onChange={setTab} /></div>
      {tab === "refunds" ? <RefundsTab /> : tab === "hubs" ? <HubsTab canSettle={canManage} /> : <BookingsTab />}
    </div>
  );
}
