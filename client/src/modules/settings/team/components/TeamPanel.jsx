import { FiKey, FiShare2, FiShield, FiUsers } from "react-icons/fi";
import AdminsPanel from "../../admins/components/AdminsPanel";
import CollaboratorsPanel from "../../collaborators/components/CollaboratorsPanel";
import RolesPanel from "../../access/components/RolesPanel";
import SharingPanel from "../../sharing/components/SharingPanel";
import { useCollaborators } from "../../collaborators/hooks/useCollaborators";
import { useAccessRoles } from "../../access/hooks/useAccessRoles";
import { useConnections } from "../../sharing/hooks/useSharing";

// Everything about WHO works with this workspace, in one place (owner-only): the people helping
// inside it (Staff) and what they may do (Roles & access), other admins content is exchanged with
// (Sharing), and creating a separate workspace for someone (Admins). Each card says what it is
// for and where things stand; picking one shows it underneath.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const TEAM_SECTIONS = ["staff", "roles", "sharing", "admins"];

function SectionCard({ active, Icon, title, purpose, status, alert, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        position: "relative", textAlign: "left", padding: "14px 16px", borderRadius: 14, cursor: "pointer", fontFamily: "Inter, sans-serif",
        border: `1.5px solid ${active ? "#25476a" : "#E5E7EB"}`, background: active ? "#F0F7FF" : "#fff",
        boxShadow: active ? "0 0 0 3px rgba(37,71,106,0.08)" : "none", transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: active ? "#25476a" : "#EEF2F7", color: active ? "#fff" : "#25476a", flexShrink: 0 }}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#0F2645" }}>{title}</span>
        {alert && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#92400E", background: "#FEF3C7", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{alert}</span>
        )}
      </span>
      <span style={{ display: "block", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{purpose}</span>
      <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: "#25476a", minHeight: 18 }}>{status}</span>
    </button>
  );
}

export default function TeamPanel({ section, onSectionChange }) {
  const { data: staff } = useCollaborators();
  const { data: roles } = useAccessRoles();
  const { data: connections } = useConnections();

  const connected = (connections || []).filter((c) => c.status === "accepted").length;
  const waitingForMe = (connections || []).filter((c) => c.status === "pending" && c.direction === "received").length;
  const active = TEAM_SECTIONS.includes(section) ? section : "staff";

  const cards = [
    {
      key: "staff", Icon: FiUsers, title: "Staff",
      purpose: "People who help you build and run this workspace.",
      status: staff ? (staff.length ? plural(staff.length, "person", "people") : "No one yet") : "",
    },
    {
      key: "roles", Icon: FiKey, title: "Roles & access",
      purpose: "What each staff member can see and change.",
      status: roles ? plural(roles.length, "role") : "",
    },
    {
      key: "sharing", Icon: FiShare2, title: "Sharing",
      purpose: "Exchange content with another admin. Each keeps their own copy.",
      status: connections ? (connected ? `Connected with ${plural(connected, "admin")}` : "Not sharing yet") : "",
      alert: waitingForMe ? `${plural(waitingForMe, "request")} for you` : null,
    },
    {
      key: "admins", Icon: FiShield, title: "Admins",
      purpose: "Give someone a separate, empty workspace of their own.",
      status: "Add an admin",
    },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 22 }}>
        {cards.map(({ key, ...card }) => (
          <SectionCard key={key} {...card} active={active === key} onClick={() => onSectionChange(key)} />
        ))}
      </div>

      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 20 }}>
        {active === "staff" && <CollaboratorsPanel onManageRoles={() => onSectionChange("roles")} />}
        {active === "roles" && <RolesPanel onManageStaff={() => onSectionChange("staff")} />}
        {active === "sharing" && <SharingPanel />}
        {active === "admins" && <AdminsPanel />}
      </div>
    </div>
  );
}
