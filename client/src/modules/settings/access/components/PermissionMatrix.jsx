export const ACTION_LABELS = { view: "View", create: "Add", edit: "Edit", delete: "Delete" };

const cell = { padding: "7px 8px", textAlign: "center", borderBottom: "1px solid #F3F4F6" };

// Modules down the side (grouped), actions across. Ticking Add/Edit/Delete also ticks View (you
// can't change what you can't see); unticking View clears the row — the server normalises roles
// the same way (access.service.js's normalisePermissions).
export default function PermissionMatrix({ modules, actions, value, onChange }) {
  const has = (module, action) => Boolean(value[module]?.includes(action));

  const setRow = (module, nextActions) => {
    const next = { ...value };
    if (nextActions.length) next[module] = actions.filter((a) => nextActions.includes(a));
    else delete next[module];
    onChange(next);
  };

  const toggle = (module, action) => {
    const current = value[module] || [];
    if (has(module, action)) setRow(module, action === "view" ? [] : current.filter((a) => a !== action));
    else setRow(module, [...new Set([...current, action, "view"])]);
  };

  const rowAll = (module) => actions.every((a) => has(module, a));
  const toggleRow = (module) => setRow(module, rowAll(module) ? [] : actions);

  const columnAll = (action) => modules.every((m) => has(m.key, action));
  const toggleColumn = (action) => {
    const next = { ...value };
    const on = !columnAll(action);
    for (const m of modules) {
      const current = next[m.key] || [];
      const updated = on
        ? [...new Set([...current, action, "view"])]
        : action === "view" ? [] : current.filter((a) => a !== action);
      if (updated.length) next[m.key] = actions.filter((a) => updated.includes(a));
      else delete next[m.key];
    }
    onChange(next);
  };

  const groups = [...new Set(modules.map((m) => m.group))];

  return (
    <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
        <thead>
          <tr style={{ background: "#F8FAFC" }}>
            <th style={{ ...cell, textAlign: "left", color: "#374151" }}>Module</th>
            {actions.map((action) => (
              <th key={action} style={cell}>
                <button type="button" onClick={() => toggleColumn(action)} title={`${columnAll(action) ? "Clear" : "Tick"} ${ACTION_LABELS[action]} for every module`} style={{ border: 0, background: "none", cursor: "pointer", fontWeight: 700, fontSize: 12.5, color: "#25476a" }}>
                  {ACTION_LABELS[action]}
                </button>
              </th>
            ))}
            <th style={{ ...cell, fontSize: 12, color: "#6B7280", fontWeight: 600 }}>All</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => [
            <tr key={`g-${group}`}>
              <td colSpan={actions.length + 2} style={{ padding: "10px 8px 4px", fontSize: 11, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "#9CA3AF" }}>{group}</td>
            </tr>,
            ...modules.filter((m) => m.group === group).map((m) => (
              <tr key={m.key}>
                <td style={{ ...cell, textAlign: "left", color: "#111827", fontWeight: 600 }}>{m.label}</td>
                {actions.map((action) => (
                  <td key={action} style={cell}>
                    <input type="checkbox" aria-label={`${m.label}: ${ACTION_LABELS[action]}`} checked={has(m.key, action)} onChange={() => toggle(m.key, action)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: action === "delete" ? "#DC2626" : "#25476a" }} />
                  </td>
                ))}
                <td style={cell}>
                  <input type="checkbox" aria-label={`${m.label}: everything`} checked={rowAll(m.key)} onChange={() => toggleRow(m.key)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                </td>
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}
