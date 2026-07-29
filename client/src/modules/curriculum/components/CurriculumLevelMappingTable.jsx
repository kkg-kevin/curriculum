// Shared by CurriculumStructurePage (part of the authoring wizard) and Settings' System Levels
// panel (manage any curriculum's mapping without opening its wizard) — same table, same row
// behavior, so the two entry points can never visually or functionally drift apart.
const GRID_COLUMNS = "54px 90px 1fr 110px 200px";

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1.5px solid #E5E7EB",
  fontSize: "13.5px", fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#111827",
  boxSizing: "border-box", outline: "none",
};
const selectStyle = {
  ...inputStyle, cursor: "pointer", appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px",
};

// No pill/switch component exists elsewhere in the app to reuse — a plain native checkbox
// underneath (for keyboard/screen-reader support) with the track+knob drawn as siblings driven
// directly off the `checked` prop, since inline styles can't express a CSS :checked selector.
function ToggleSwitch({ checked, onChange, title }) {
  return (
    <label title={title} style={{ position: "relative", display: "inline-block", width: "38px", height: "22px", flexShrink: 0, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer" }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, borderRadius: "999px",
          backgroundColor: checked ? "#25476a" : "#D1D5DB",
          transition: "background-color 0.15s",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute", top: "3px", left: checked ? "19px" : "3px",
          width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3)", transition: "left 0.15s",
        }}
      />
    </label>
  );
}

function SystemLevelRow({ level, cls, stages, onToggle, onChangeField }) {
  const included = !!cls;
  const stageName = stages.find((s) => s.id === cls?.developmentalStageId)?.name || "";
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: "10px", alignItems: "center",
        padding: "9px 10px", borderRadius: "8px", backgroundColor: included ? "#FAFCFF" : "transparent",
      }}
    >
      <ToggleSwitch checked={included} onChange={() => onToggle(level)} title={`${included ? "Remove" : "Include"} ${level.name} in this curriculum`} />
      <span style={{ fontSize: "11px", fontWeight: "700", color: "#9CA3AF" }}>{level.name}</span>
      <input
        style={{ ...inputStyle, opacity: included ? 1 : 0.5 }}
        disabled={!included}
        value={cls?.name || ""}
        onChange={(e) => onChangeField(level.id, "name", e.target.value)}
        placeholder="Curriculum label, e.g. Grade 4"
      />
      <input
        style={{ ...inputStyle, opacity: included ? 1 : 0.5 }}
        disabled={!included}
        value={cls?.shortLabel || ""}
        onChange={(e) => onChangeField(level.id, "shortLabel", e.target.value)}
        placeholder="optional"
      />
      <select
        style={{ ...selectStyle, opacity: included ? 1 : 0.5 }}
        disabled={!included}
        value={cls?.developmentalStageId || ""}
        onChange={(e) => onChangeField(level.id, "developmentalStageId", e.target.value || null)}
        title={stageName || undefined}
      >
        <option value="">{stages.length ? "— Not set —" : "— Add Developmental Stages in Competencies first —"}</option>
        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}

// Read-only summary shown once a curriculum's level mapping has been saved — the table itself
// only reappears via "Edit". Sorted by each level's System Level sequence, not save order.
export function CurriculumLevelMappingPreview({ systemLevels, classes, stages }) {
  const sequenceById = new Map(systemLevels.map((l) => [l.id, l.sequence]));
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  const sorted = [...classes].sort((a, b) => (sequenceById.get(a.systemLevelId) ?? 0) - (sequenceById.get(b.systemLevelId) ?? 0));

  if (sorted.length === 0) {
    return (
      <div style={{ padding: "22px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No grades configured yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {sorted.map((cls) => (
        <div key={cls.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", backgroundColor: "#FAFCFF", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#25476a", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "20px", padding: "2px 9px", flexShrink: 0 }}>
            System Level {sequenceById.get(cls.systemLevelId) ?? "?"}
          </span>
          <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#111827" }}>{cls.name}</span>
          {cls.shortLabel && <span style={{ fontSize: "12px", color: "#6B7280" }}>({cls.shortLabel})</span>}
          {cls.developmentalStageId && stageNameById.get(cls.developmentalStageId) && (
            <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "#9CA3AF" }}>{stageNameById.get(cls.developmentalStageId)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CurriculumLevelMappingTable({ systemLevels, classes, stages, onToggle, onChangeField }) {
  if (systemLevels.length === 0) {
    return (
      <div style={{ padding: "22px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
          No System Levels defined yet — add them in Settings → System Levels first.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: "560px", display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: "10px", padding: "0 10px 6px", fontSize: "10.5px", fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Include</span>
          <span>System Level</span>
          <span>Curriculum Label</span>
          <span>Short Label</span>
          <span>Phase</span>
        </div>
        {systemLevels.map((level) => (
          <SystemLevelRow
            key={level.id}
            level={level}
            cls={classes.find((c) => c.systemLevelId === level.id) || null}
            stages={stages}
            onToggle={onToggle}
            onChangeField={onChangeField}
          />
        ))}
      </div>
    </div>
  );
}
