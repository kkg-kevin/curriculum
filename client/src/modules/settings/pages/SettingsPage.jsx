import { useState, useEffect } from "react";
import CompetenciesPanel from "../competencies/components/CompetenciesPanel";
import LearningAreasPanel from "../learning-areas/components/LearningAreasPanel";

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes stg-fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes stg-spin    { to { transform:rotate(360deg); } }

  .stg-card {
    background:#fff; border-radius:16px; padding:22px 24px;
    box-shadow:0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04);
  }

  .stg-btn-primary {
    padding:10px 20px; background:#feb139; color:#25476a; border:none; border-radius:10px;
    font-size:13px; font-weight:700; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px; transition:background 0.15s, transform 0.1s; white-space:nowrap;
  }
  .stg-btn-primary:hover:not(:disabled) { background:#f5a827; }
  .stg-btn-primary:active:not(:disabled) { transform:scale(0.98); }
  .stg-btn-primary:disabled { background:#fde3b0; cursor:not-allowed; }

  .stg-btn-secondary {
    padding:9px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB;
    border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; transition:all 0.15s; white-space:nowrap;
  }
  .stg-btn-secondary:hover { background:#F3F4F6; }

  .stg-input, .stg-textarea {
    padding:10px 12px; border-radius:10px; border:1.5px solid #E5E7EB;
    font-size:14px; font-family:Inter,sans-serif; background:#F9FAFB;
    color:#374151; outline:none; width:100%; box-sizing:border-box;
    transition:border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .stg-input:focus, .stg-textarea:focus {
    border-color:#38aae1; background:#fff; box-shadow:0 0 0 3px rgba(56,170,225,0.12);
  }
  .stg-textarea { resize:vertical; }

  .stg-spinner {
    width:22px; height:22px; border:2.5px solid #E5E7EB; border-top-color:#25476a;
    border-radius:50%; animation:stg-spin 0.7s linear infinite; margin:60px auto;
  }

  .stg-empty {
    text-align:center; padding:56px 24px; background:#fff;
    border:2px dashed #E5E7EB; border-radius:16px; animation:stg-fadein 0.2s ease;
  }

  .stg-grid {
    display:grid; grid-template-columns:repeat(auto-fill, minmax(272px,1fr));
    gap:16px; align-items:start;
  }
  @media(max-width:560px){ .stg-grid { grid-template-columns:1fr; } }

  .stg-comp-card {
    position:relative; background:#fff; border:1.5px solid #E5E7EB; border-radius:16px;
    padding:18px 20px; display:flex; flex-direction:column;
    transition:border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    animation:stg-fadein 0.18s ease;
  }
  .stg-comp-card:hover {
    border-color:#b8d9ee; box-shadow:0 6px 20px rgba(37,71,106,0.1); transform:translateY(-2px);
  }
  .stg-comp-card-top { display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; }
  .stg-avatar {
    width:44px; height:44px; border-radius:12px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; font-weight:800;
  }
  .stg-comp-desc {
    margin:0; font-size:12.5px; color:#6B7280; line-height:1.6;
    display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;
    flex:1;
  }

  .stg-kebab-btn {
    width:28px; height:28px; border-radius:8px; border:none; background:transparent;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:#D1D5DB; transition:background 0.12s, color 0.12s; flex-shrink:0;
  }
  .stg-kebab-btn:hover { background:#F3F4F6; color:#374151; }
  .stg-menu {
    position:absolute; top:calc(100% + 4px); right:0; z-index:200;
    background:#fff; border:1px solid #E5E7EB; border-radius:10px;
    box-shadow:0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06);
    min-width:140px; padding:4px; animation:stg-fadein 0.12s ease;
  }
  .stg-menu-item {
    display:flex; align-items:center; gap:8px; width:100%;
    padding:8px 10px; border:none; border-radius:7px; background:transparent;
    font-size:12px; font-weight:600; font-family:Inter,sans-serif; color:#374151;
    cursor:pointer; text-align:left; transition:background 0.1s, color 0.1s;
  }
  .stg-menu-item:hover { background:#F3F4F6; color:#111827; }
  .stg-menu-item--danger { color:#DC2626; }
  .stg-menu-item--danger:hover { background:#FEF2F2; }

  .stg-modal-overlay {
    position:fixed; inset:0; z-index:1000; background:rgba(15,38,69,0.45);
    display:flex; align-items:flex-start; justify-content:center;
    padding:40px 16px; overflow-y:auto; animation:stg-fadein 0.15s ease;
  }
  .stg-modal {
    background:#fff; border-radius:18px; width:100%; max-width:480px;
    box-shadow:0 24px 64px rgba(0,0,0,0.25); overflow:hidden;
  }
  .stg-modal-header {
    padding:20px 24px; background:linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%);
  }
  .stg-modal-close {
    background:rgba(255,255,255,0.12); border:none; color:#fff; cursor:pointer;
    font-size:16px; line-height:1; width:26px; height:26px; border-radius:8px;
    display:flex; align-items:center; justify-content:center; transition:background 0.12s;
  }
  .stg-modal-close:hover { background:rgba(255,255,255,0.22); }
  .stg-field-label {
    font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:5px;
  }

  .stg-tabs { display:flex; gap:6px; margin-bottom:20px; border-bottom:2px solid #F3F4F6; }
  .stg-tab-btn {
    padding:9px 16px; background:none; border:none; border-bottom:2.5px solid transparent;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#6B7280;
    cursor:pointer; margin-bottom:-2px; transition:color 0.15s, border-color 0.15s;
  }
  .stg-tab-btn:hover { color:#25476a; }
  .stg-tab-btn.active { color:#25476a; border-bottom-color:#25476a; }

  .stg-swatch {
    width:26px; height:26px; border-radius:50%; border:2px solid #fff; cursor:pointer; padding:0;
    box-shadow:0 0 0 1.5px #E5E7EB; transition:box-shadow 0.15s, transform 0.1s;
  }
  .stg-swatch:hover { transform:scale(1.08); }
  .stg-swatch.active { box-shadow:0 0 0 2px #111827; }

  .stg-chip {
    display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:20px;
    border:1px solid; font-size:12px; font-weight:600; font-family:Inter,sans-serif;
  }
  .stg-chip-x {
    background:none; border:none; cursor:pointer; font-size:14px; line-height:1; padding:0; color:inherit;
  }

  .stg-list { display:flex; flex-direction:column; gap:8px; }

  .stg-item {
    display:flex; flex-direction:column; align-items:stretch; gap:0;
    padding:16px 18px; border-radius:12px; border:1.5px solid #E5E7EB;
    background:#FAFAFA; transition:border-color 0.15s, background 0.15s;
    animation:stg-fadein 0.18s ease;
  }
  .stg-item:hover { border-color:#b8d9ee; background:#F8FBFF; }
  .stg-item-top { display:flex; align-items:center; gap:12px; }
  .stg-item-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .stg-item-name { flex:1; min-width:0; font-size:14px; font-weight:700; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .stg-item-sub  { font-size:12.5px; color:#9CA3AF; font-weight:400; margin-top:4px; line-height:1.6; }

  .stg-icon-btn {
    width:30px; height:30px; border-radius:8px; border:none; background:transparent;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:#9CA3AF; transition:background 0.12s, color 0.12s; flex-shrink:0;
  }
  .stg-icon-btn:hover        { background:#F3F4F6; color:#374151; }
  .stg-icon-btn.danger:hover { background:#FEF2F2; color:#DC2626; }

  .stg-course-section { margin-top:12px; padding-top:12px; border-top:1px dashed #E5E7EB; }
  .stg-course-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
  .stg-course-header-left { display:flex; align-items:center; gap:6px; }
  .stg-course-title { font-size:12px; font-weight:700; color:#374151; font-family:Inter,sans-serif; }
  .stg-course-count-badge {
    padding:1px 8px; border-radius:20px; font-size:10.5px; font-weight:700; border:1px solid;
  }
  .stg-course-list { display:flex; flex-direction:column; gap:5px; }
  .stg-course-row {
    display:flex; align-items:center; gap:8px;
    padding:6px 10px; border-radius:8px; background:#fff;
    border:1px solid #EEF0F2; transition:border-color 0.12s, background 0.12s;
  }
  .stg-course-row:hover { background:#FAFCFF; }
  .stg-course-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  .stg-course-name { flex:1; min-width:0; font-size:12.5px; font-weight:600; color:#1F2937; word-break:break-word; }

  .stg-search-wrap { position:relative; margin-bottom:14px; max-width:280px; }
  .stg-search-icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#9CA3AF; pointer-events:none; }
  .stg-search-input {
    width:100%; box-sizing:border-box; padding:10px 12px 10px 36px; border-radius:10px;
    border:1.5px solid #E5E7EB; font-size:13.5px; font-family:Inter,sans-serif;
    background:#F9FAFB; color:#374151; outline:none;
    transition:border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .stg-search-input:focus {
    border-color:#38aae1; background:#fff; box-shadow:0 0 0 3px rgba(56,170,225,0.12);
  }
`;

/* ── Page ──────────────────────────────────────────────────────────────── */

const TABS = [
  { key: "competencies", label: "Competencies" },
  { key: "learning-areas", label: "Learning Areas" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("competencies");

  useEffect(() => {
    const el = document.createElement("style");
    el.id = "settings-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("settings-styles")?.remove(); };
  }, []);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", position: "relative" }}>Settings</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px", position: "relative" }}>
          Define shared catalogs here. Competencies are referenced live everywhere; learning areas are copied when a module imports them, so local edits stay local.
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
        {activeTab === "learning-areas" && <LearningAreasPanel />}
      </div>
    </div>
  );
}
