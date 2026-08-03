// Generic multi-select chip toggle — click a chip to add/remove it from `value`. Same visual
// pattern as the amenities picker in LearningHubForm.jsx. Works on a plain string array; callers
// that persist a comma-joined string (e.g. learner.languages) convert at the boundary, not here.
export default function MultiSelectChips({ options, value = [], onChange }) {
  const toggle = (option) => {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {options.map((option) => {
        const active = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            style={{
              padding: "7px 13px", borderRadius: "20px",
              border: `1.5px solid ${active ? "#38aae1" : "#E5E7EB"}`,
              backgroundColor: active ? "#e8f5fb" : "#fff",
              color: active ? "#25476a" : "#6B7280",
              fontSize: "12.5px", fontWeight: active ? "700" : "500", fontFamily: "Inter, sans-serif",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
