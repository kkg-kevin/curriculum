import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Add as AddIcon, CheckCircle as CheckCircleIcon, Close as CloseIcon, LocationOn as LocationOnIcon, MenuBook as MenuBookIcon, PauseCircle as PauseCircleIcon } from "@mui/icons-material";
import { useLocationsQuery } from "../hooks/useLocation";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import { setLocationFilter, clearLocationFilters } from "../../../store/locationsSlice";
import { KENYA_COUNTIES } from "../schemas/location.schema";
import { LocationCard } from "../components/LocationCard";

const selectStyle = {
  padding: "8px 32px 8px 12px",
  borderRadius: "8px",
  border: "1px solid #E5E7EB",
  fontSize: "13px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: "#F9FAFB",
  color: "#374151",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

function EmptyState({ hasFilters, onClearFilters, onCreateNew }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 20px" }}>
        📍
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
        {hasFilters ? "No results found" : "No locations yet"}
      </h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>
        {hasFilters ? "Try adjusting your filters." : "Add your first location to get started."}
      </p>
      {hasFilters ? (
        <button type="button" onClick={onClearFilters} style={{ padding: "10px 24px", backgroundColor: "transparent", color: "#25476a", border: "1.5px solid #25476a", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Clear Filters
        </button>
      ) : (
        <button type="button" onClick={onCreateNew} style={{ padding: "10px 24px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 4px 12px rgba(254,177,57,0.35)" }}>
          + Add Location
        </button>
      )}
    </div>
  );
}

export default function LocationsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const filters = useSelector((state) => state.locations.filters);

  const { data, isLoading, isError, error } = useLocationsQuery();
  const { data: curriculaData } = useCurriculaQuery();

  const locations = data?.data || [];
  const curriculaMap = (curriculaData?.data || []).reduce((m, c) => { m[c.id] = c; return m; }, {});

  const hasFilters = !!filters.status || !!filters.county;
  const activeCount = locations.filter((l) => l.status === "active").length;
  const withCurriculum = locations.filter((l) => l.curriculumId).length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Locations
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Manage every place a curriculum is used — schools, campuses, branches, and other learning spaces.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/locations/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <AddIcon fontSize="small" />
            Add Location
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "Total Locations",   value: isLoading ? "—" : locations.length,                    icon: <LocationOnIcon fontSize="small" />, bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Active",            value: isLoading ? "—" : activeCount,                          icon: <CheckCircleIcon fontSize="small" />, bg: "#dff2fb", color: "#38aae1", border: "#a8d5ee" },
          { label: "Inactive",          value: isLoading ? "—" : locations.length - activeCount,       icon: <PauseCircleIcon fontSize="small" />, bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
          { label: "With Curriculum",   value: isLoading ? "—" : withCurriculum,                       icon: <MenuBookIcon fontSize="small" />, bg: "#fff8e6", color: "#feb139", border: "#fcd97a" },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "#ffffff", borderRadius: "14px", border: `1.5px solid ${stat.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "11px", backgroundColor: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: stat.color }}>
              {stat.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "3px 0 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <select value={filters.status} onChange={(e) => dispatch(setLocationFilter({ status: e.target.value }))} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={filters.county} onChange={(e) => dispatch(setLocationFilter({ county: e.target.value }))} style={selectStyle}>
          <option value="">All Counties</option>
          {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasFilters && (
          <button type="button" onClick={() => dispatch(clearLocationFilters())} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            <CloseIcon fontSize="small" />
            Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "13px", color: "#9CA3AF" }}>
          {isLoading ? "Loading..." : `${locations.length} result${locations.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "#e8f5fb" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ height: "15px", width: "55%", backgroundColor: "#EEF2F7", borderRadius: "5px" }} />
                    <div style={{ height: "11px", width: "35%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                  </div>
                </div>
                <div style={{ height: "12px", width: "45%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ height: "60px", backgroundColor: "#F9FAFB", borderRadius: "10px" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          ⚠ Failed to load locations: {error?.message}
        </div>
      ) : locations.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          onClearFilters={() => dispatch(clearLocationFilters())}
          onCreateNew={() => navigate("/locations/create")}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {locations.map((location) => (
            <LocationCard key={location.id} location={location} curriculaMap={curriculaMap} />
          ))}
        </div>
      )}
    </div>
  );
}
