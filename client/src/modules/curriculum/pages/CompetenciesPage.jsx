import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

/* ── Constants ──────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
  { n: 5, label: "Competencies" },
];

const AGE_GROUPS = [
  { id: "ag1", label: "3 – 6"   },
  { id: "ag2", label: "7 – 9"   },
  { id: "ag3", label: "10 – 12" },
  { id: "ag4", label: "13 – 15" },
  { id: "ag5", label: "16 – 18" },
];

const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes cp-fadein { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

  .cp-steps { display:flex; align-items:center; justify-content:center; margin-bottom:32px; }
  .cp-connector { width:60px; height:2px; flex-shrink:0; margin:0 6px; margin-bottom:20px; }
  @media(max-width:580px){ .cp-connector{width:28px;} .cp-steps{justify-content:flex-start;overflow-x:auto;padding-bottom:4px;} }

  .cp-layout { display:grid; grid-template-columns:220px 1fr; gap:20px; align-items:start; }
  @media(max-width:800px){ .cp-layout{ grid-template-columns:1fr; } }

  .cp-sidebar {
    background:#fff; border-radius:16px; border:1.5px solid #E5E7EB;
    box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden; position:sticky; top:20px;
  }
  .cp-sidebar-head {
    padding:14px 16px 12px; background:linear-gradient(135deg,#0A3880,#2e7db5);
    border-bottom:1px solid rgba(255,255,255,0.1);
  }
  .cp-nav-item {
    width:100%; display:flex; align-items:center; gap:10px;
    padding:11px 16px; background:none; border:none; border-bottom:1px solid #F5F5F5;
    font-family:Inter,sans-serif; text-align:left; cursor:pointer; transition:background 0.12s; color:#374151;
  }
  .cp-nav-item:last-child { border-bottom:none; }
  .cp-nav-item:hover { background:#F9FAFB; }
  .cp-nav-item.active { background:#e8f5fb; color:#25476a; }

  .cp-input, .cp-textarea {
    width:100%; padding:10px 13px; border-radius:10px;
    border:1.5px solid #E5E7EB; font-size:14px; font-family:Inter,sans-serif;
    background:#F9FAFB; color:#111827; box-sizing:border-box; outline:none;
    transition:border-color 0.15s, box-shadow 0.15s, background 0.15s; resize:none;
  }
  .cp-input:focus, .cp-textarea:focus {
    border-color:#25476a; background:#F0F7FF; box-shadow:0 0 0 3px rgba(37,71,106,0.1);
  }
  .cp-input.err, .cp-textarea.err { border-color:#EF4444; background:#FFF5F5; }

  .cp-btn-primary {
    padding:9px 18px; background:#25476a; color:#fff; border:none; border-radius:9px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px; transition:background 0.15s; white-space:nowrap;
  }
  .cp-btn-primary:hover:not(:disabled) { background:#0A3880; }
  .cp-btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
  .cp-btn-secondary {
    padding:8px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB;
    border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s; white-space:nowrap;
  }
  .cp-btn-secondary:hover { background:#F3F4F6; }
  .cp-btn-ghost {
    padding:7px 13px; background:#e8f5fb; color:#25476a; border:1.5px solid #a8d5ee;
    border-radius:8px; font-size:12px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; transition:all 0.15s; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;
  }
  .cp-btn-ghost:hover { background:#d6edf8; }
  .cp-btn-danger {
    padding:7px 13px; background:#FFF5F5; color:#DC2626; border:1.5px solid #FECACA;
    border-radius:8px; font-size:12px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; transition:all 0.15s; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;
  }
  .cp-btn-danger:hover { background:#FEE2E2; }

  /* Item cards */
  .cp-item-card {
    background:#fff; border-radius:14px; border:1.5px solid #E5E7EB;
    border-left-width:4px; padding:16px 18px;
    display:flex; align-items:flex-start; gap:14px;
    box-shadow:0 1px 4px rgba(0,0,0,0.04);
    transition:box-shadow 0.15s, border-color 0.15s;
    animation:cp-fadein 0.18s ease;
  }
  .cp-item-card:hover { box-shadow:0 3px 12px rgba(37,71,106,0.09); border-color:#CBD5E1; }

  /* Assignment cards (progression ladder) */
  .cp-asn-card { background:#fff; border:1.5px solid #E5E7EB; border-radius:13px; overflow:hidden; animation:cp-fadein 0.15s ease; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
  .cp-asn-head { padding:10px 14px; background:linear-gradient(135deg,#25476a 0%,#2e7db5 100%); display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .cp-asn-body { padding:13px 16px; }
  .cp-asn-edit { padding:13px 16px; background:#F0F7FF; border-top:1px solid #E8F0FE; }

  .cp-ladder { display:grid; grid-template-columns:200px 1fr; gap:16px; align-items:start; }
  @media(max-width:680px){ .cp-ladder{ grid-template-columns:1fr; } }

  .cp-rung-slot {
    width:100%; display:flex; align-items:center; gap:10px; padding:12px 14px;
    background:none; border:none; border-bottom:1px solid #F3F4F6; text-align:left;
    font-family:Inter,sans-serif; cursor:pointer; transition:background 0.12s;
  }
  .cp-rung-slot:last-child { border-bottom:none; }
  .cp-rung-slot:hover { background:#F9FAFB; }
  .cp-rung-slot.active { background:#e8f5fb; }

  .cp-comp-pick-item {
    width:100%; display:flex; align-items:flex-start; gap:10px; padding:8px 10px;
    border-radius:9px; cursor:pointer; transition:background 0.1s;
    border:1.5px solid transparent; background:none; font-family:Inter,sans-serif; text-align:left;
  }
  .cp-comp-pick-item:hover { background:#F3F4F6; }
  .cp-comp-pick-item.selected { background:#e8f5fb; border-color:#a8d5ee; }
`;

/* ── Shared style objects ───────────────────────────────────────────────── */

const card = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "22px 24px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)",
};

const fieldLabel = { display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "7px" };
const errTxt     = { fontSize: "12px", color: "#EF4444", marginTop: "5px", marginBottom: 0 };

/* ── StepIndicator ──────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="cp-steps">
      {STEPS.map((step, i) => {
        const done = step.n < current, active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: done || active ? "#25476a" : "#F3F4F6",
                border: `2.5px solid ${done || active ? "#25476a" : "#E5E7EB"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "#9CA3AF",
                fontSize: done ? "15px" : "13px", fontWeight: "700", flexShrink: 0,
                boxShadow: active ? "0 0 0 4px rgba(37,71,106,0.1)" : "none",
              }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active ? "700" : "400", color: active ? "#25476a" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap" }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="cp-connector" style={{ backgroundColor: done ? "#25476a" : "#E5E7EB" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── SidebarNav ─────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  {
    id: "learning-areas",
    label: "Learning Areas",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "competencies",
    label: "Competencies",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "progression-ladder",
    label: "Progression Ladder",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <line x1="8" y1="6"  x2="21" y2="6"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="6"  x2="3.01" y2="6"  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

function SidebarNav({ active, onChange }) {
  return (
    <div className="cp-sidebar">
      <div className="cp-sidebar-head">
        <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>Competencies</p>
        <p style={{ margin: "3px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Configure sub-modules</p>
      </div>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`cp-nav-item${active === item.id ? " active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span style={{ flexShrink: 0, color: "inherit", opacity: active === item.id ? 1 : 0.55 }}>{item.icon}</span>
          <span style={{ fontSize: "13px", fontWeight: active === item.id ? "700" : "500" }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── ItemForm — shared for Learning Areas + Competencies ────────────────── */

function ItemForm({ initial = { name: "", description: "" }, onSave, onCancel, submitLabel = "Save" }) {
  const [name, setName]       = useState(initial.name);
  const [desc, setDesc]       = useState(initial.description);
  const [nameErr, setNameErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setNameErr("Name is required"); return; }
    onSave({ name: name.trim(), description: desc.trim() });
  };

  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px", background: "#F8FAFF", border: "1.5px solid #C7D9F8", borderRadius: "12px", animation: "cp-fadein 0.15s ease" }}>
      <div>
        <label style={fieldLabel}>Name <span style={{ color: "#EF4444" }}>*</span></label>
        <input
          className={`cp-input${nameErr ? " err" : ""}`}
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr(""); }}
          placeholder="Enter name…"
          autoFocus
        />
        {nameErr && <p style={errTxt}>{nameErr}</p>}
      </div>
      <div>
        <label style={fieldLabel}>Description</label>
        <textarea
          className="cp-textarea"
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Optional description…"
        />
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button type="button" className="cp-btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="cp-btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}

/* ── LearningAreasPanel ─────────────────────────────────────────────────── */

function LearningAreasPanel({ items, onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);

  const handleAdd = ({ name, description }) => {
    onChange([...items, { id: genId(), name, description }]);
    setShowAdd(false);
  };

  const handleEdit = (id, data) => {
    onChange(items.map((it) => it.id === id ? { ...it, ...data } : it));
    setEditId(null);
  };

  const handleDelete = (id) => onChange(items.filter((it) => it.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showAdd ? "16px" : 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Learning Areas</h2>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
              {items.length} {items.length === 1 ? "area" : "areas"} — courses with the same learning area will be grouped together.
            </p>
          </div>
          {!showAdd && (
            <button type="button" className="cp-btn-primary" onClick={() => { setShowAdd(true); setEditId(null); }}>+ Add</button>
          )}
        </div>
        {showAdd && (
          <ItemForm submitLabel="Add Learning Area" onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        )}
      </div>

      {items.length === 0 && !showAdd ? (
        <div style={{ textAlign: "center", padding: "56px 32px", backgroundColor: "#FAFAFA", border: "2px dashed #E5E7EB", borderRadius: "16px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📚</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No learning areas yet</p>
          <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#9CA3AF" }}>Define the broad areas that courses will be grouped under.</p>
          <button type="button" className="cp-btn-primary" onClick={() => setShowAdd(true)}>+ Add Learning Area</button>
        </div>
      ) : items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {items.map((item, idx) => (
            <div key={item.id}>
              {editId === item.id ? (
                <ItemForm
                  initial={{ name: item.name, description: item.description }}
                  submitLabel="Save Changes"
                  onSave={(data) => handleEdit(item.id, data)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className="cp-item-card" style={{ borderLeftColor: "#25476a" }}>
                  {/* Index badge */}
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "11px", flexShrink: 0,
                    backgroundColor: "#e8f5fb", border: "1.5px solid #a8d5ee",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "15px", fontWeight: "800", color: "#25476a",
                  }}>
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{item.name}</p>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "#9CA3AF", backgroundColor: "#F3F4F6", borderRadius: "20px", padding: "2px 7px" }}>
                        #{idx + 1}
                      </span>
                    </div>
                    {item.description
                      ? <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>{item.description}</p>
                      : <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No description added</p>
                    }
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button type="button" className="cp-btn-ghost" onClick={() => { setEditId(item.id); setShowAdd(false); }}>Edit</button>
                    <button type="button" className="cp-btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── CompetenciesPanel ──────────────────────────────────────────────────── */

function CompetenciesPanel({ items, onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);

  const handleAdd = ({ name, description }) => {
    onChange([...items, { id: genId(), name, description }]);
    setShowAdd(false);
  };

  const handleEdit = (id, data) => {
    onChange(items.map((it) => it.id === id ? { ...it, ...data } : it));
    setEditId(null);
  };

  const handleDelete = (id) => onChange(items.filter((it) => it.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showAdd ? "16px" : 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Competencies</h2>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
              {items.length} {items.length === 1 ? "competency" : "competencies"} — e.g. Communication, Creativity, Critical Thinking.
            </p>
          </div>
          {!showAdd && (
            <button type="button" className="cp-btn-primary" onClick={() => { setShowAdd(true); setEditId(null); }}>+ Add</button>
          )}
        </div>
        {showAdd && (
          <ItemForm submitLabel="Add Competency" onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        )}
      </div>

      {items.length === 0 && !showAdd ? (
        <div style={{ textAlign: "center", padding: "56px 32px", backgroundColor: "#FAFAFA", border: "2px dashed #E5E7EB", borderRadius: "16px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⭐</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No competencies yet</p>
          <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#9CA3AF" }}>Add the core competencies for this curriculum.</p>
          <button type="button" className="cp-btn-primary" onClick={() => setShowAdd(true)}>+ Add Competency</button>
        </div>
      ) : items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {items.map((item) => (
            <div key={item.id}>
              {editId === item.id ? (
                <ItemForm
                  initial={{ name: item.name, description: item.description }}
                  submitLabel="Save Changes"
                  onSave={(data) => handleEdit(item.id, data)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className="cp-item-card" style={{ borderLeftColor: "#feb139" }}>
                  {/* Star avatar */}
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "11px", flexShrink: 0,
                    backgroundColor: "#fff8e6", border: "1.5px solid #fcd97a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px",
                  }}>
                    ⭐
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 3px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>{item.name}</p>
                    {item.description
                      ? <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>{item.description}</p>
                      : <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No description added</p>
                    }
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button type="button" className="cp-btn-ghost" onClick={() => { setEditId(item.id); setShowAdd(false); }}>Edit</button>
                    <button type="button" className="cp-btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ProgressionLadderPanel ─────────────────────────────────────────────── */

function ProgressionLadderPanel({ competencies, rungs, onRungs }) {
  const [selectedId, setSelectedId]           = useState(AGE_GROUPS[0].id);
  const [mode, setMode]                       = useState("view"); // "view" | "create" | "edit"
  const [form, setForm]                       = useState({ name: "", description: "" });
  const [formErr, setFormErr]                 = useState({});
  const [showPicker, setShowPicker]           = useState(false);
  const [pickedCompId, setPickedCompId]       = useState(null);
  const [pickedDesc, setPickedDesc]           = useState("");
  const [pickedDescErr, setPickedDescErr]     = useState("");
  const [editAsnId, setEditAsnId]             = useState(null);
  const [editAsnDesc, setEditAsnDesc]         = useState("");

  const selectedGroup = AGE_GROUPS.find((ag) => ag.id === selectedId);
  const rung          = rungs[selectedId] || null;
  const assignedIds   = rung?.assignments?.map((a) => a.competencyId) || [];
  const available     = competencies.filter((c) => !assignedIds.includes(c.id));

  const selectSlot = (agId) => {
    setSelectedId(agId);
    setMode("view");
    setShowPicker(false);
    setPickedCompId(null);
    setPickedDesc("");
    setPickedDescErr("");
    setEditAsnId(null);
    setFormErr({});
  };

  const startCreate = () => {
    setForm({ name: "", description: "" });
    setFormErr({});
    setMode("create");
  };

  const saveCreate = () => {
    if (!form.name.trim()) { setFormErr({ name: "Name is required" }); return; }
    onRungs({ ...rungs, [selectedId]: { name: form.name.trim(), description: form.description.trim(), assignments: [] } });
    setMode("view");
  };

  const startEdit = () => {
    setForm({ name: rung.name, description: rung.description });
    setFormErr({});
    setMode("edit");
  };

  const saveEdit = () => {
    if (!form.name.trim()) { setFormErr({ name: "Name is required" }); return; }
    onRungs({ ...rungs, [selectedId]: { ...rung, name: form.name.trim(), description: form.description.trim() } });
    setMode("view");
  };

  const deleteRung = () => {
    const next = { ...rungs };
    delete next[selectedId];
    onRungs(next);
    setMode("view");
  };

  const assignCompetency = () => {
    if (!pickedCompId) return;
    if (!pickedDesc.trim()) { setPickedDescErr("Please describe what this competency looks like at this stage"); return; }
    onRungs({ ...rungs, [selectedId]: { ...rung, assignments: [...rung.assignments, { competencyId: pickedCompId, descriptor: pickedDesc.trim() }] } });
    setShowPicker(false);
    setPickedCompId(null);
    setPickedDesc("");
    setPickedDescErr("");
  };

  const removeAssignment = (compId) => {
    onRungs({ ...rungs, [selectedId]: { ...rung, assignments: rung.assignments.filter((a) => a.competencyId !== compId) } });
  };

  const saveAsnEdit = (compId) => {
    onRungs({ ...rungs, [selectedId]: { ...rung, assignments: rung.assignments.map((a) => a.competencyId === compId ? { ...a, descriptor: editAsnDesc } : a) } });
    setEditAsnId(null);
    setEditAsnDesc("");
  };

  const RungForm = ({ onSave }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
      <div>
        <label style={fieldLabel}>Name <span style={{ color: "#EF4444" }}>*</span></label>
        <input
          className={`cp-input${formErr.name ? " err" : ""}`}
          value={form.name}
          onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormErr({}); }}
          placeholder="e.g. Explorer, Navigator, Trailblazer…"
          autoFocus
        />
        {formErr.name && <p style={errTxt}>{formErr.name}</p>}
      </div>
      <div>
        <label style={fieldLabel}>Description</label>
        <textarea
          className="cp-textarea"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Describe what this stage means…"
        />
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button type="button" className="cp-btn-secondary" onClick={() => setMode("view")}>Cancel</button>
        <button type="button" className="cp-btn-primary" onClick={onSave}>Save</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Progression Ladder</h2>
        <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
          Five preset age groups. Configure each slot with a custom name and map competencies to it.
        </p>
      </div>

      {/* Ladder + detail */}
      <div className="cp-ladder">

        {/* Left: age group slots */}
        <div style={{ background: "#fff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "12px 14px", background: "linear-gradient(135deg,#25476a,#2e7db5)" }}>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Age Groups</p>
          </div>
          {AGE_GROUPS.map((ag) => {
            const r          = rungs[ag.id];
            const isSelected = ag.id === selectedId;
            return (
              <button key={ag.id} type="button" className={`cp-rung-slot${isSelected ? " active" : ""}`} onClick={() => selectSlot(ag.id)}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
                  backgroundColor: isSelected ? "#25476a" : r ? "#e8f5fb" : "#F3F4F6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: isSelected ? "#fff" : r ? "#25476a" : "#9CA3AF", textAlign: "center", lineHeight: 1.2 }}>
                    {ag.label}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: isSelected ? "#25476a" : r ? "#111827" : "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r ? r.name : "Not set"}
                  </p>
                  {r && (
                    <p style={{ margin: "1px 0 0", fontSize: "10px", color: "#9CA3AF" }}>
                      {r.assignments.length} competenc{r.assignments.length === 1 ? "y" : "ies"}
                    </p>
                  )}
                </div>
                {isSelected && <div style={{ width: "3px", height: "26px", backgroundColor: "#25476a", borderRadius: "4px", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        {/* Right: detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Slot header card */}
          <div style={{ ...card, backgroundColor: rung ? "#F0F7FF" : "#FAFAFA", border: `1.5px solid ${rung ? "#a8d5ee" : "#E5E7EB"}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Ages {selectedGroup?.label}
                </p>
                {rung && mode === "view" ? (
                  <>
                    <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: "800", color: "#0F2645" }}>{rung.name}</h3>
                    {rung.description && <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>{rung.description}</p>}
                  </>
                ) : !rung && mode === "view" ? (
                  <p style={{ margin: 0, fontSize: "14px", color: "#9CA3AF" }}>This slot hasn't been configured yet.</p>
                ) : (
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>
                    {mode === "edit" ? "Edit this slot" : "Set up this slot"}
                  </p>
                )}
              </div>
              {rung && mode === "view" && (
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button type="button" className="cp-btn-ghost" onClick={startEdit}>Edit</button>
                  <button type="button" className="cp-btn-danger" onClick={deleteRung}>Remove</button>
                </div>
              )}
            </div>

            {mode === "create" && <RungForm onSave={saveCreate} />}
            {mode === "edit"   && <RungForm onSave={saveEdit} />}
            {!rung && mode === "view" && (
              <button type="button" className="cp-btn-primary" style={{ marginTop: "14px" }} onClick={startCreate}>
                + Configure this slot
              </button>
            )}
          </div>

          {/* Competency assignments */}
          {rung && mode === "view" && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid #F3F4F6" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Competencies at this stage</h4>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                    {rung.assignments.length === 0 ? "None assigned yet." : `${rung.assignments.length} assigned`}
                  </p>
                </div>
                {!showPicker && available.length > 0 && (
                  <button type="button" className="cp-btn-ghost" onClick={() => { setShowPicker(true); setPickedCompId(null); setPickedDesc(""); setPickedDescErr(""); }}>
                    + Assign
                  </button>
                )}
              </div>

              {/* Assigned list */}
              {rung.assignments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: showPicker ? "16px" : 0 }}>
                  {rung.assignments.map((a) => {
                    const comp = competencies.find((c) => c.id === a.competencyId);
                    if (!comp) return null;
                    return (
                      <div key={a.competencyId} className="cp-asn-card">
                        {/* Header */}
                        <div className="cp-asn-head">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                            <span style={{ width: "22px", height: "22px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", flexShrink: 0 }}>⭐</span>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comp.name}</span>
                          </div>
                          {editAsnId !== a.competencyId && (
                            <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => { setEditAsnId(a.competencyId); setEditAsnDesc(a.descriptor); }}
                                style={{ padding: "4px 10px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "7px", color: "#fff", fontSize: "11px", fontWeight: "600", fontFamily: "Inter,sans-serif", cursor: "pointer" }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAssignment(a.competencyId)}
                                style={{ padding: "4px 10px", background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "7px", color: "#fca5a5", fontSize: "11px", fontWeight: "600", fontFamily: "Inter,sans-serif", cursor: "pointer" }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Body / Edit */}
                        {editAsnId === a.competencyId ? (
                          <div className="cp-asn-edit">
                            <textarea
                              className="cp-textarea"
                              rows={3}
                              value={editAsnDesc}
                              onChange={(e) => setEditAsnDesc(e.target.value)}
                              placeholder="Describe what this competency looks like at this stage…"
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "10px" }}>
                              <button type="button" className="cp-btn-secondary" style={{ fontSize: "12px", padding: "6px 12px" }} onClick={() => setEditAsnId(null)}>Cancel</button>
                              <button type="button" className="cp-btn-primary" style={{ fontSize: "12px", padding: "6px 12px" }} onClick={() => saveAsnEdit(a.competencyId)}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <div className="cp-asn-body">
                            {a.descriptor
                              ? <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>{a.descriptor}</p>
                              : <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No descriptor yet — click Edit to add one.</p>
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty + no competencies warning */}
              {rung.assignments.length === 0 && !showPicker && (
                <div style={{ textAlign: "center", padding: "28px", backgroundColor: "#FAFAFA", border: "1.5px dashed #E5E7EB", borderRadius: "12px" }}>
                  {competencies.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                      Go to <strong>Competencies</strong> first to define them, then come back to assign them here.
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#9CA3AF" }}>No competencies assigned to this stage yet.</p>
                      <button type="button" className="cp-btn-ghost" onClick={() => setShowPicker(true)}>+ Assign Competency</button>
                    </>
                  )}
                </div>
              )}

              {/* Picker */}
              {showPicker && (
                <div style={{ padding: "16px", background: "#F0F7FF", borderRadius: "12px", border: "1.5px solid #C7D9F8", animation: "cp-fadein 0.15s ease" }}>
                  <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#25476a" }}>Select a competency</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto", marginBottom: "14px" }}>
                    {available.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>All competencies are already assigned to this stage.</p>
                    ) : available.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`cp-comp-pick-item${pickedCompId === c.id ? " selected" : ""}`}
                        onClick={() => setPickedCompId(c.id)}
                      >
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0, marginTop: "2px", border: `2px solid ${pickedCompId === c.id ? "#25476a" : "#D1D5DB"}`, backgroundColor: pickedCompId === c.id ? "#25476a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {pickedCompId === c.id && <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#fff" }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827" }}>{c.name}</p>
                          {c.description && <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</p>}
                        </div>
                      </button>
                    ))}
                  </div>

                  {pickedCompId && (
                    <div style={{ marginBottom: "14px" }}>
                      <label style={{ ...fieldLabel, marginBottom: "6px" }}>
                        What does <strong>{competencies.find((c) => c.id === pickedCompId)?.name}</strong> look like at this stage?
                        <span style={{ color: "#EF4444" }}> *</span>
                      </label>
                      <textarea
                        className={`cp-textarea${pickedDescErr ? " err" : ""}`}
                        rows={3}
                        value={pickedDesc}
                        onChange={(e) => { setPickedDesc(e.target.value); setPickedDescErr(""); }}
                        placeholder="e.g. Can express basic ideas using simple words and pictures…"
                        autoFocus
                      />
                      {pickedDescErr && <p style={errTxt}>{pickedDescErr}</p>}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button type="button" className="cp-btn-secondary" onClick={() => { setShowPicker(false); setPickedCompId(null); setPickedDesc(""); setPickedDescErr(""); }}>Cancel</button>
                    <button type="button" className="cp-btn-primary" disabled={!pickedCompId} onClick={assignCompetency}>Assign</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function CompetenciesPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [activeNav,     setActiveNav]     = useState("learning-areas");
  const [learningAreas, setLearningAreas] = useState([]);
  const [competencies,  setCompetencies]  = useState([]);
  const [rungs,         setRungs]         = useState({});

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "12px", fontFamily: "Inter,sans-serif", cursor: "pointer", padding: 0 }}>
              Curriculum
            </button>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>Competencies</span>
          </div>
          <h1 style={{ margin: "0 0 3px", fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>Competencies</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Define learning areas, competencies and the progression ladder for this curriculum.</p>
        </div>
        <button type="button" onClick={() => navigate("/curriculum")} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter,sans-serif", cursor: "pointer", flexShrink: 0 }}>
          Done
        </button>
      </div>

      {/* Step indicator */}
      <StepIndicator current={5} />

      {/* Main layout */}
      <div className="cp-layout">
        <SidebarNav active={activeNav} onChange={setActiveNav} />

        <div>
          {activeNav === "learning-areas" && (
            <LearningAreasPanel items={learningAreas} onChange={setLearningAreas} />
          )}
          {activeNav === "competencies" && (
            <CompetenciesPanel items={competencies} onChange={setCompetencies} />
          )}
          {activeNav === "progression-ladder" && (
            <ProgressionLadderPanel competencies={competencies} rungs={rungs} onRungs={setRungs} />
          )}
        </div>
      </div>
    </div>
  );
}
