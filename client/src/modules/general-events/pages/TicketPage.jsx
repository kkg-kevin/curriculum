import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiAlertTriangle, FiCalendar, FiCheckCircle, FiMapPin, FiUserCheck, FiUsers } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";
import { errorOf, generalEventsApi } from "../services/generalEventsApi";
import { GENERAL_EVENT_KEYS } from "../hooks/useGeneralEvents";
import { btn } from "../shared";

// /ticket/:code — where a general event's ticket QR code leads (server: general-event.service.js's
// ticket / ticketCheckIn). No layout and no sign-in required, because whoever scans it decides
// what it is:
//   staff of the event's workspace, signed in on this phone → who it is, whether the ticket is good,
//     and "Let them in" (the whole party is marked arrived) — the door's whole job in one tap
//   anyone else (the ticket holder checking their own QR) → "show this at the entrance"
const page = { minHeight: "100vh", background: "#F5F7FA", fontFamily: FONT, padding: "28px 16px 40px", boxSizing: "border-box" };
const wrap = { maxWidth: 460, margin: "0 auto", display: "grid", gap: 14 };

function Shell({ children }) {
  return <div style={page}><div style={wrap}>{children}</div></div>;
}

function Note({ title, children, tone = "neutral" }) {
  return (
    <Shell>
      <div style={{ ...card, padding: "28px 24px", textAlign: "center", display: "grid", gap: 8 }}>
        <span aria-hidden="true" style={{ margin: "0 auto", width: 52, height: 52, borderRadius: "50%", background: tone === "bad" ? "#FDECEC" : BRAND.skyTint, color: tone === "bad" ? BRAND.danger : BRAND.navy, display: "grid", placeItems: "center" }}>
          {tone === "bad" ? <FiAlertTriangle size={24} /> : <FiUserCheck size={24} />}
        </span>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: BRAND.ink }}>{title}</h1>
        <div style={{ fontSize: 14, color: BRAND.inkSoft, lineHeight: 1.55 }}>{children}</div>
      </div>
    </Shell>
  );
}

const isStaffSession = (user) => ["admin", "collaborator"].includes(user?.role);

export default function TicketPage() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  const staff = isStaffSession(user) && can(user, "general-events", "view");
  const mayLetIn = staff && can(user, "general-events", "edit");
  const qc = useQueryClient();
  const [done, setDone] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["event-ticket", code],
    queryFn: () => generalEventsApi.ticket(code),
    enabled: staff,
    retry: false,
  });
  const letIn = useMutation({
    mutationFn: () => generalEventsApi.ticketCheckIn(code),
    onSuccess: (result) => {
      setDone(result);
      qc.setQueryData(["event-ticket", code], result);
      qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.registrations(result.event.id) });
      qc.invalidateQueries({ queryKey: GENERAL_EVENT_KEYS.detail(result.event.id) });
    },
  });

  // The person holding the ticket sees this at once; staff see their view once their sign-in is
  // confirmed (a new tab checks it first).
  if (loading || !staff) {
    return (
      <Note title={`Ticket ${String(code || "").toUpperCase()}`}>
        This is a Digifunzi event ticket. Show this QR code (or say the code) at the entrance and we&rsquo;ll check you in.
        {!user && !loading && <div style={{ marginTop: 14, fontSize: 12.5, color: BRAND.muted }}>On the team at the door? <Link to="/login" state={{ from: { pathname: `/ticket/${code}` } }} style={{ color: BRAND.mid, fontWeight: 700 }}>Sign in</Link> and scan it again.</div>}
      </Note>
    );
  }
  if (isLoading) return <Note title="One moment…">Checking this ticket.</Note>;
  if (error || !data) return <Note title="Ticket not found" tone="bad">{errorOf(error) || "We couldn't find this ticket."}</Note>;

  const { registration: r, event, ticket } = data;
  const tone = !ticket.valid ? "bad" : ticket.used ? "used" : "good";
  const colours = { good: ["#E6F4EA", "#1E6B3A"], used: [BRAND.skyTint, BRAND.navy], bad: ["#FDECEC", BRAND.danger] }[tone];
  return (
    <Shell>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ background: colours[0], color: colours[1], padding: "18px 20px", display: "flex", gap: 12, alignItems: "center" }}>
          {tone === "bad" ? <FiAlertTriangle size={28} /> : <FiCheckCircle size={28} />}
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>{done?.justCheckedIn ? "Checked in — welcome!" : ticket.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, fontFamily: "Consolas, monospace", letterSpacing: "0.08em" }}>{data.code}</div>
          </div>
        </div>
        <div style={{ padding: "18px 20px", display: "grid", gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.ink }}>{r.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill("info")}><FiUsers size={11} /> Admits {r.partySize}</span>
            {r.attendedAt && <span style={pill("strong")}>Arrived {new Date(r.attendedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" })}</span>}
          </div>
          <div style={{ fontSize: 13.5, color: BRAND.inkSoft, display: "grid", gap: 4 }}>
            <strong style={{ color: BRAND.ink }}>{event.title}</strong>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><FiCalendar size={13} /> {event.when}</span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><FiMapPin size={13} /> {event.where}</span>
          </div>
          {letIn.error && <div style={{ color: BRAND.danger, fontSize: 13 }}>{errorOf(letIn.error)}</div>}
          {mayLetIn && ticket.valid && !ticket.used && (
            <button type="button" onClick={() => letIn.mutate()} disabled={letIn.isPending} style={btn("primary", { minHeight: 52, fontSize: 16, width: "100%", justifyContent: "center" })}>
              <FiUserCheck size={18} /> {letIn.isPending ? "Checking in…" : `Let ${r.partySize === 1 ? "them" : `all ${r.partySize}`} in`}
            </button>
          )}
          <Link to={`/events/general/${event.id}?tab=checkin`} style={{ textAlign: "center", fontSize: 13.5, fontWeight: 700, color: BRAND.mid }}>Open the event&rsquo;s check-in</Link>
        </div>
      </div>
      <p style={{ margin: 0, textAlign: "center", fontSize: 12.5, color: BRAND.muted }}>Scan the next ticket with your phone&rsquo;s camera.</p>
    </Shell>
  );
}
