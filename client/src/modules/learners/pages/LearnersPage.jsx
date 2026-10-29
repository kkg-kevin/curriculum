import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { School as SchoolIcon, Close as CloseIcon, Groups as GroupsIcon, PersonOff as PersonOffIcon } from "@mui/icons-material";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { LEARNING_HUB_TYPES } from "../../learning-hubs/schemas/learningHub.schema";
import { learnerCreatePath } from "../../../routes/portalPaths";
import { useAllLearnersQuery, useLearnerLogins, useSetLearnerLoginActive } from "../hooks/useLearners";
import { FiKey, FiUser, FiUsers } from "react-icons/fi";
import { Tabs } from "../../../components/ui/TabBar";
import { learnerApi } from "../services/learnerApi";
import { LearnerCard } from "../components/LearnerCard";
import ParentsPanel from "../components/ParentsPanel";
import UsersTable from "../../settings/users/components/UsersTable";
import { usePermissions } from "../../../hooks/usePermissions";

const inputStyle  = { padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", minWidth: 200 };

const PAGE_TABS = [
  { key: "learners", label: "Learners", icon: FiUsers },
  { key: "logins", label: "Parent & learner logins", icon: FiKey },
  { key: "parents", label: "Parents", icon: FiUser },
];

// Parents' and learners' own logins — the kind of account, which child or hub, last used, and the
// sign-in switch (Settings → Users lists the workspace's other logins). Switching needs Learners
// → Edit for staff.
function LearnerLoginsPanel() {
  const { can } = usePermissions();
  const { data, isLoading, isError } = useLearnerLogins();
  const { mutate: setActive, isPending } = useSetLearnerLoginActive();
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <UsersTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        setActive={setActive}
        isPending={isPending}
        canSwitch={can("learners", "edit")}
        heading="Parent & learner logins"
        description="Every parent and learner who can sign in — a parent with their email (and sees all their children), a learner with their own username."
        searchPlaceholder="Search name, email, username, child or hub"
        csvName="parent-and-learner-logins.csv"
        noun="logins"
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#F3F4F6" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 15, width: "55%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
          <div style={{ height: 11, width: "35%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
        </div>
      </div>
      <div style={{ height: 62, backgroundColor: "#F9FAFB", borderRadius: 12 }} />
    </div>
  );
}

// One hub on the Learners page's first view — click it to see its learners. `special` is one of
// the two extra tiles: "none" (learners in no hub yet) or "all" (every learner).
function HubTile({ hub, special, count, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const name = special === "all" ? "All learners" : special === "none" ? "Not in a hub yet" : hub.name;
  const sub = special === "all" ? "Everyone, whichever hub"
    : special === "none" ? "Enrolled on their own — add a hub from their profile"
    : [LEARNING_HUB_TYPES.find((t) => t.value === hub.hubType)?.label || hub.hubType, hub.code].filter(Boolean).join(" · ");
  const icon = special === "all" ? <GroupsIcon fontSize="small" />
    : special === "none" ? <PersonOffIcon fontSize="small" />
    : hub.photo ? <img src={hub.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    : hub.hubType === "school" ? <SchoolIcon fontSize="small" /> : (hub.name?.[0]?.toUpperCase() || "?");
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: "left", padding: "18px 20px", borderRadius: 16, cursor: "pointer", fontFamily: "Inter, sans-serif",
        backgroundColor: special ? "#F9FAFB" : "#ffffff", border: `1.5px ${special ? "dashed" : "solid"} ${hovered ? "#a8d5ee" : "#E5E7EB"}`,
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.10)" : "0 1px 4px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-2px)" : "none", transition: "box-shadow 0.2s, transform 0.2s, border-color 0.2s",
        display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: special ? "#e8f5fb" : "linear-gradient(135deg, #1a3550, #2e7db5)", color: special ? "#25476a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", fontWeight: 700 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? "#25476a" : "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>
            {sub}
            {hub?.status === "inactive" && <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: "#F3F4F6", color: "#6B7280" }}>Inactive</span>}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span>
          <span style={{ fontSize: 24, fontWeight: 900, color: "#25476a" }}>{count}</span>
          <span style={{ marginLeft: 6, fontSize: 13, color: "#6B7280" }}>learner{count !== 1 ? "s" : ""}</span>
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#38aae1" }}>View →</span>
      </div>
    </button>
  );
}

export default function LearnersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?tab=logins — Parent & learner logins (where Settings → Users points for those accounts);
  // ?tab=parents — every parent's details, one row per family.
  const tab = ["logins", "parents"].includes(searchParams.get("tab")) ? searchParams.get("tab") : "learners";
  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next !== "learners") params.set("tab", next); else params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  const [search, setSearch] = useState("");
  // ?hub= — whose learners are open: a hub's id, "all" or "none" (no hub yet); without it the page
  // shows the hubs. ?schoolId= (older links, e.g. from a hub's own page) opens that hub too.
  const openHubId = searchParams.get("hub") || searchParams.get("schoolId") || "";
  const openHub = (value) => {
    const params = new URLSearchParams(searchParams);
    params.delete("schoolId");
    if (value) params.set("hub", value); else params.delete("hub");
    setSearchParams(params); // a new history entry, so Back returns to the hubs
    setSearch("");
  };

  const { data: schoolsData,  isLoading: schoolsLoading  } = useAllLearningHubsQuery();
  const { data: learnersData, isLoading: learnersLoading } = useAllLearnersQuery();

  const schools  = useMemo(() => [...(schoolsData?.data || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")), [schoolsData]);
  const learners = useMemo(() => learnersData?.data || [], [learnersData]);
  const isHub = !!openHubId && openHubId !== "all" && openHubId !== "none";
  const openHubRecord = isHub ? schools.find((s) => s.id === openHubId) : null;

  // A hub's own roster — the schoolId-scoped list every hub-aware page uses, which also carries
  // each learner's admission number and class there (see learner.service.js's getAllLearners).
  const { data: hubLearnersData, isLoading: hubLearnersLoading } = useQuery({
    queryKey: ["learners", "bySchool", openHubId],
    queryFn:  () => learnerApi.getAll({ schoolId: openHubId }),
    enabled:  isHub,
  });

  // Learners per hub, from each learner's hubIds — a learner at two hubs counts in both.
  const { countByHub, noHubCount } = useMemo(() => {
    const counts = new Map();
    let none = 0;
    learners.forEach((l) => {
      const ids = l.hubIds || [];
      if (ids.length === 0) none += 1;
      ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    });
    return { countByHub: counts, noHubCount: none };
  }, [learners]);

  const term = search.trim().toLowerCase();
  const pool = isHub ? (hubLearnersData?.data || [])
    : openHubId === "none" ? learners.filter((l) => (l.hubIds || []).length === 0)
    : learners;
  // From the hubs, typing searches every learner.
  const showLearners = !!openHubId || !!term;
  const filteredLearners = pool.filter((l) =>
    !term || `${l.firstName} ${l.lastName}`.toLowerCase().includes(term) || l.guardianName?.toLowerCase().includes(term));

  const isLoading = schoolsLoading || learnersLoading || (isHub && hubLearnersLoading);
  const openTitle = isHub ? (openHubRecord?.name || "Learning hub") : openHubId === "all" ? "All learners" : openHubId === "none" ? "Not in a hub yet" : "Search results";

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Learners
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px" }}>
              Every learner, independent of any school. Enroll a learner on their own, then assign them to one or more learning hubs from their profile.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => navigate(learnerCreatePath("admin", isHub ? openHubId : undefined))}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Enroll Learner
          </button>
          <button
            type="button"
            onClick={() => navigate(`/learners/bulk-import${isHub ? `?hubId=${openHubId}` : ""}`)}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Bulk Import
          </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs label="Learners" tabs={PAGE_TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "logins" ? <LearnerLoginsPanel /> : tab === "parents" ? <ParentsPanel /> : (<>
      {/* Filter bar */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {openHubId && (
          <button type="button" onClick={() => openHub("")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", backgroundColor: "#e8f5fb", color: "#25476a", border: "1.5px solid #a8d5ee", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ← All hubs
          </button>
        )}
        {showLearners && <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{openTitle}</span>}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={openHubId ? "Search by learner or guardian name…" : "Search every learner by name or guardian…"}
          style={inputStyle}
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            <CloseIcon fontSize="inherit" style={{ fontSize: 13 }} /> Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {isLoading ? "Loading…"
            : showLearners ? `${filteredLearners.length} learner${filteredLearners.length !== 1 ? "s" : ""}`
            : `${schools.length} hub${schools.length !== 1 ? "s" : ""} · ${learners.length} learner${learners.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {!showLearners ? (
        isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {schools.map((hub) => (
              <HubTile key={hub.id} hub={hub} count={countByHub.get(hub.id) || 0} onOpen={() => openHub(hub.id)} />
            ))}
            <HubTile special="none" count={noHubCount} onOpen={() => openHub("none")} />
            <HubTile special="all" count={learners.length} onOpen={() => openHub("all")} />
          </div>
        )
      ) : isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : filteredLearners.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#e8f5fb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <SchoolIcon sx={{ color: "#25476a" }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            {term ? "No learners match this search" : isHub ? "No learners at this hub yet" : openHubId === "none" ? "Every learner is in a hub" : "No learners yet"}
          </p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            {term ? "Try a different name." : isHub ? "Enroll a learner here, or add one from their profile's Learning Hubs." : openHubId === "none" ? "" : "Enroll your first learner to get started."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filteredLearners.map((learner) => (
            <LearnerCard key={learner.id} learner={learner} />
          ))}
        </div>
      )}
      </>)}
    </div>
  );
}
