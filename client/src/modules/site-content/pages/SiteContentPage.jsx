import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiGlobe, FiAlertTriangle, FiEdit2, FiTrash2, FiCalendar, FiUsers } from "react-icons/fi";
import { useBootcampsQuery, useDeleteBootcamp, useProjectsQuery, useDeleteProject } from "../hooks/useSiteContent";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const STATUS_BADGE = {
  upcoming: { bg: "#fff8e6", color: "#b8860b", border: "#fcd97a", label: "Upcoming" },
  active: { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active" },
  completed: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Completed" },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.upcoming;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function PublishedBadge({ isPublished }) {
  return (
    <span style={{
      padding: "2px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700",
      backgroundColor: isPublished ? "#DCFCE7" : "#F3F4F6", color: isPublished ? "#166534" : "#9CA3AF",
      border: `1px solid ${isPublished ? "#BBF7D0" : "#E5E7EB"}`,
    }}>
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function EmptyState({ label, onCreateNew }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", margin: "0 auto 20px" }}>
        <FiGlobe size={32} strokeWidth={1.8} />
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>No {label} yet</h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>
        Content authored here appears on the public marketing site once published.
      </p>
      <button type="button" onClick={onCreateNew} style={{ padding: "10px 24px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 4px 12px rgba(254,177,57,0.35)" }}>
        + Add
      </button>
    </div>
  );
}

function RecordRow({ record, kind, onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: "hidden",
        background: record.coverImage ? undefined : "linear-gradient(135deg, #1a3550, #25476a)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
      }}>
        {record.coverImage ? (
          <img src={record.coverImage} alt={record.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <FiGlobe size={18} strokeWidth={1.8} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13.5, color: "#111827" }}>{record.name}</strong>
          {kind === "bootcamp" && <StatusBadge status={record.status} />}
          <PublishedBadge isPublished={record.isPublished} />
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 560 }}>
          {record.description || "—"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: 11.5, color: "#9CA3AF" }}>
          {kind === "bootcamp" ? (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <FiCalendar size={12} /> {record.startDate || "—"} → {record.endDate || "—"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <FiUsers size={12} /> {(record.classes || []).length} class{(record.classes || []).length !== 1 ? "es" : ""}
              </span>
            </>
          ) : (
            <>
              <span>Ages {record.ageMin ?? "—"}–{record.ageMax ?? "—"}</span>
              <span>{record.sessionCount ?? "—"} session{record.sessionCount === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onEdit(record)}
          title="Edit"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", backgroundColor: "transparent", color: "#25476a", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          <FiEdit2 size={12} strokeWidth={2} /> Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(record)}
          title="Delete"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, backgroundColor: "transparent", color: "#EF4444", border: "1.5px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}
        >
          <FiTrash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function BootcampsTab() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useBootcampsQuery();
  const { mutate: deleteBootcamp } = useDeleteBootcamp();
  const [toDelete, setToDelete] = useState(null);
  const records = data?.data || [];

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
      {isLoading ? (
        <div style={{ padding: "42px 20px", textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading bootcamps…</div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", color: "#EF4444", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <FiAlertTriangle size={15} /> Failed to load bootcamps: {error?.message}
        </div>
      ) : records.length === 0 ? (
        <EmptyState label="bootcamps" onCreateNew={() => navigate("/site-content/bootcamps/create")} />
      ) : (
        records.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            kind="bootcamp"
            onEdit={(r) => navigate(`/site-content/bootcamps/${r.id}/edit`)}
            onDelete={setToDelete}
          />
        ))
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title="Delete Bootcamp"
        message={`"${toDelete?.name}" will be permanently removed from the public site. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { deleteBootcamp(toDelete.id); setToDelete(null); }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function ProjectsTab() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useProjectsQuery();
  const { mutate: deleteProject } = useDeleteProject();
  const [toDelete, setToDelete] = useState(null);
  const records = data?.data || [];

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
      {isLoading ? (
        <div style={{ padding: "42px 20px", textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading projects…</div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", color: "#EF4444", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <FiAlertTriangle size={15} /> Failed to load projects: {error?.message}
        </div>
      ) : records.length === 0 ? (
        <EmptyState label="projects" onCreateNew={() => navigate("/site-content/projects/create")} />
      ) : (
        records.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            kind="project"
            onEdit={(r) => navigate(`/site-content/projects/${r.id}/edit`)}
            onDelete={setToDelete}
          />
        ))
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title="Delete Project"
        message={`"${toDelete?.name}" will be permanently removed from the public site. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { deleteProject(toDelete.id); setToDelete(null); }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

const TABS = [
  { value: "bootcamps", label: "Bootcamps" },
  { value: "projects", label: "Projects" },
];

export default function SiteContentPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bootcamps");

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Website Content
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "520px" }}>
              Bootcamps and projects shown on the public marketing site — digifunzi.com.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(tab === "bootcamps" ? "/site-content/bootcamps/create" : "/site-content/projects/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            {tab === "bootcamps" ? "New Bootcamp" : "New Project"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "1px solid " + (tab === t.value ? "#25476a" : "#D7DEE8"),
              background: tab === t.value ? "#25476a" : "#fff",
              color: tab === t.value ? "#fff" : "#374151",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bootcamps" ? <BootcampsTab /> : <ProjectsTab />}
    </div>
  );
}
