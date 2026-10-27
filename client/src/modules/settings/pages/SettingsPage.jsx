import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import CompetenciesPanel from "../competencies/components/CompetenciesPanel";
import PathwayTemplatesPanel from "../pathways/components/PathwayTemplatesPanel";
import SystemLevelsPanel from "../system-levels/components/SystemLevelsPanel";
import ItemsPanel from "../items/components/ItemsPanel";
import LearningHubsPanel from "../learning-hubs/components/LearningHubsPanel";
import TeamPanel, { TEAM_SECTIONS } from "../team/components/TeamPanel";
import EmailsPanel from "../emails/components/EmailsPanel";
import CertificateSettingsPanel from "../certificates/components/CertificateSettingsPanel";
import PaymentsPanel from "../payments/PaymentsPanel";
import PaymentMethodsSection from "../payments/PaymentMethodsSection";
import PartPaymentsSection from "../payments/PartPaymentsSection";
import { SettingsPage as SettingsLayoutPage } from "../components/SettingsLayout";
import EducatorPayPanel from "../educator-pay/EducatorPayPanel";
import { can } from "../../../hooks/usePermissions";
import { useAuth } from "../../../context/AuthContext";
import { useSettingsStyles } from "../components/settingsStyles";

/* ── CSS ────────────────────────────────────────────────────────────────── */



/* ── Page ──────────────────────────────────────────────────────────────── */

const ALL_TABS = [
  { key: "competencies", label: "Competencies" },
  { key: "pathways", label: "Pathways" },
  { key: "system-levels", label: "System Levels" },
  { key: "items", label: "Items" }, // Goods (formerly Inventory) + Services
  { key: "learning-hubs", label: "Learning Hubs" },
  // Staff, Roles & access, Sharing and Admins, together — see TeamPanel.
  { key: "people", label: "People & sharing" },
  // Which emails the workspace sends, and which the admin receives — see EmailsPanel.
  { key: "emails", label: "Emails" },
  // Who signs the workspace's certificates of completion — see CertificateSettingsPanel.
  { key: "certificates", label: "Certificates" },
  // How families can pay at the end of a website sign-up (PaymentMethodsSection), and the
  // workspace's own M-Pesa Paybill connection (PaymentsPanel).
  { key: "payments", label: "Payments" },
  // The rates educators are paid at, for the whole workspace — see EducatorPayPanel.
  { key: "educator-pay", label: "Educator pay" },
];

// Workspace management — only ever the owner (the server refuses these for staff too).
const OWNER_ONLY_TABS = ["people", "emails", "certificates", "payments"];

// Staff, Roles & access, Sharing and Admins used to be tabs of their own; links to them (the
// sharing notifications, bookmarks) open the matching section of People & sharing.
const FORMER_TABS = { collaborators: "staff", staff: "staff", roles: "roles", sharing: "sharing", admins: "admins" };

export default function SettingsPage() {
  const { user } = useAuth();
  // A collaborator (see scope.middleware.js's attachOwnRecords) gets full parity with admin on
  // every other settings tab — those are content the invited admin lets them edit — but Admins
  // and Collaborators are tenant management, refused server-side (blockIfCollaboratorRestricted)
  // regardless of the role alias, so they're hidden here rather than shown and broken.
  // Educator pay: staff only with Claim approvals → Edit, the permission the server asks for.
  const TABS = (user?.role === "collaborator" ? ALL_TABS.filter((t) => !OWNER_ONLY_TABS.includes(t.key)) : ALL_TABS)
    .filter((t) => t.key !== "educator-pay" || can(user, "claims-approval", "edit"));
  const [searchParams] = useSearchParams();
  // The old Inventory tab is now Items → Goods, so ?tab=inventory links still land in the right place.
  const rawTab = searchParams.get("tab");
  const requestedTab = rawTab === "inventory" ? "items" : FORMER_TABS[rawTab] ? "people" : rawTab;
  const requestedSection = FORMER_TABS[rawTab] || searchParams.get("section");
  const itemsKind = rawTab === "inventory" ? "goods" : searchParams.get("kind") || "goods";
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.key === requestedTab) ? requestedTab : "competencies"
  );
  const [teamSection, setTeamSection] = useState(TEAM_SECTIONS.includes(requestedSection) ? requestedSection : "staff");

  // A link followed while already on this page (e.g. a sharing notification) still lands on the
  // right tab and section.
  useEffect(() => {
    if (requestedTab && TABS.some((t) => t.key === requestedTab)) setActiveTab(requestedTab);
    if (TEAM_SECTIONS.includes(requestedSection)) setTeamSection(requestedSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab, requestedSection]);

  useSettingsStyles();

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", position: "relative" }}>Settings</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px", position: "relative" }}>
          Define shared catalogs here. Competencies are referenced live everywhere; pathways are copied when a module imports them, so local edits stay local.
        </p>
      </div>

      <div className="stg-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key} type="button"
            className={`stg-tab-btn${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="stg-card">
        {activeTab === "competencies" && <CompetenciesPanel />}
        {activeTab === "pathways" && <PathwayTemplatesPanel />}
        {activeTab === "system-levels" && <SystemLevelsPanel />}
        {activeTab === "items" && <ItemsPanel initialKind={itemsKind} />}
        {activeTab === "learning-hubs" && <LearningHubsPanel />}
        {activeTab === "people" && <TeamPanel section={teamSection} onSectionChange={setTeamSection} />}
        {activeTab === "emails" && <EmailsPanel />}
        {activeTab === "certificates" && <CertificateSettingsPanel />}
        {activeTab === "payments" && (
          <SettingsLayoutPage title="Payments" description="How families pay their invoices, paying in parts, and the M-Pesa connection that confirms Paybill payments automatically.">
            <PaymentMethodsSection />
            <PartPaymentsSection />
            <PaymentsPanel />
          </SettingsLayoutPage>
        )}
        {activeTab === "educator-pay" && <EducatorPayPanel />}
      </div>
    </div>
  );
}
