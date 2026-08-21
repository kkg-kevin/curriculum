import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FiArrowLeft, FiUpload } from "react-icons/fi";
import { School as SchoolIcon } from "@mui/icons-material";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { useAllClassesQuery } from "../../classes/hooks/useClasses";
import SchoolPickerCard from "../../learning-hubs/components/SchoolPickerCard";
import BulkImportLearnersPanel from "../components/BulkImportLearnersPanel";

function StatusPill({ status }) {
  const isActive = status === "active";
  const isDraft = status === "draft";
  const backgroundColor = isActive ? "#ECFDF5" : isDraft ? "#FFFBEB" : "#F9FAFB";
  const color = isActive ? "#059669" : isDraft ? "#B45309" : "#6B7280";
  const border = isActive ? "#A7F3D0" : isDraft ? "#FDE68A" : "#E5E7EB";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, backgroundColor, color, border: `1px solid ${border}`, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
      {status || "unknown"}
    </span>
  );
}

export default function AdminBulkImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedHubId, setSelectedHubId] = useState(searchParams.get("hubId") || "");

  const { data: hubsData, isLoading: hubsLoading } = useAllLearningHubsQuery({ includeDrafts: true });
  const { data: classesData, isLoading: classesLoading } = useAllClassesQuery();

  const hubs = hubsData?.data || [];
  const classes = classesData?.data || [];

  const classesByHub = useMemo(() => {
    const map = {};
    for (const cls of classes) {
      if (!map[cls.schoolId]) map[cls.schoolId] = [];
      map[cls.schoolId].push(cls);
    }
    return map;
  }, [classes]);

  const defaultHubId = useMemo(() => {
    const activeHub = hubs.find((hub) => hub.status === "active");
    return activeHub?.id || hubs[0]?.id || "";
  }, [hubs]);

  useEffect(() => {
    if (!selectedHubId && defaultHubId) {
      setSelectedHubId(defaultHubId);
      setSearchParams({ hubId: defaultHubId }, { replace: true });
      return;
    }
    if (selectedHubId && hubs.length > 0 && !hubs.some((hub) => hub.id === selectedHubId)) {
      setSelectedHubId(defaultHubId);
      if (defaultHubId) setSearchParams({ hubId: defaultHubId }, { replace: true });
    }
  }, [defaultHubId, hubs, selectedHubId, setSearchParams]);

  const selectedHub = hubs.find((hub) => hub.id === selectedHubId) || null;
  const selectedClasses = selectedHubId ? (classesByHub[selectedHubId] || []) : [];

  const handleSelectHub = (hubId) => {
    setSelectedHubId(hubId);
    setSearchParams({ hubId }, { replace: true });
  };

  const isLoading = hubsLoading || classesLoading;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate("/learners")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          <FiArrowLeft size={13} />
          Back to Learners
        </button>
      </div>

      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -24, right: 120, width: 108, height: 108, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 680 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Bulk Import Learners
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
              Choose a hub, choose one of its classes, and upload a CSV to enroll many learners in one go.
              This uses the same import pipeline as the school portal, but gives admins a direct entry point.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffffff", fontSize: 14, fontWeight: 700 }}>
            <FiUpload size={16} />
            Admin workflow
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 22px", minHeight: 170 }} />
          ))}
        </div>
      ) : hubs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No hubs found</p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Create a learning hub first, then come back here to bulk import learners into it.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              1. Choose a hub
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {hubs.map((hub) => {
                const hubClasses = classesByHub[hub.id] || [];
                const selected = selectedHubId === hub.id;
                return (
                  <div key={hub.id} style={{ borderRadius: 16, outline: selected ? "3px solid rgba(56,170,225,0.32)" : "none", outlineOffset: 2 }}>
                    <SchoolPickerCard
                      school={hub}
                      icon={<SchoolIcon fontSize="small" sx={{ color: "#25476a" }} />}
                      count={hubClasses.length}
                      countLabel={hubClasses.length === 1 ? "class" : "classes"}
                      subStat={`${hub.status === "active" ? "Active" : hub.status === "draft" ? "Draft" : "Inactive"}${selected ? " - Selected" : ""}`}
                      onClick={() => handleSelectHub(hub.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {selectedHub && (
            <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected hub</p>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>{selectedHub.name}</h3>
                <p style={{ margin: "5px 0 0", fontSize: 13, color: "#6B7280" }}>
                  {selectedClasses.length} class{selectedClasses.length !== 1 ? "es" : ""} available for import.
                </p>
              </div>
              <StatusPill status={selectedHub.status} />
            </div>
          )}

          {selectedHub && (
            <BulkImportLearnersPanel
              key={selectedHub.id}
              hubId={selectedHub.id}
              classes={selectedClasses}
              onClose={() => navigate("/learners")}
              onImported={() => {
                qc.invalidateQueries({ queryKey: ["learners", "all"] });
                qc.invalidateQueries({ queryKey: ["learners", "bySchool", selectedHub.id] });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
