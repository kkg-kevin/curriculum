import { useState } from "react";
import { FiBookOpen, FiChevronDown, FiEdit2, FiFolder, FiMoreVertical, FiSearch, FiTrash2 } from "react-icons/fi";
import {
  usePathwayTemplates, useCreatePathwayTemplate, useUpdatePathwayTemplate, useDeletePathwayTemplate,
} from "../hooks/usePathwayTemplates";
import { Modal, Label } from "../../components/Modal";
import { PALETTE } from "../../palette";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import { useCoursesQuery } from "../../../courses/hooks/useCourse";
import CoursePickerField from "../../../courses/components/CoursePickerField";

const COLORS = PALETTE;

function PathwayModal({ editTarget, onClose }) {
  const { mutate: create, isPending: creating } = useCreatePathwayTemplate();
  const { mutate: update, isPending: updating } = useUpdatePathwayTemplate();
  const isPending = creating || updating;

  const [form, setForm] = useState(() => ({
    name: editTarget?.name || "",
    description: editTarget?.description || "",
    color: editTarget?.color || COLORS[0],
  }));
  const [courses, setCourses] = useState(editTarget?.courses || []);
  const [error, setError] = useState("");
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      courses,
    };
    const onSuccess = () => onClose();
    if (editTarget) update({ id: editTarget.id, data }, { onSuccess });
    else create(data, { onSuccess });
  };

  return (
    <Modal
      title={editTarget ? "Edit Pathway" : "Add Pathway"}
      subtitle="A reusable template a curriculum can import as a starting point"
      onClose={onClose}
      footer={<>
        <button type="button" className="stg-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="stg-btn-primary" onClick={submit} disabled={isPending}>
          {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Pathway"}
        </button>
      </>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "10px", color: "#EF4444", fontSize: "13px" }}>{error}</div>}
        <div>
          <Label>Name *</Label>
          <input className="stg-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Software Engineer" />
        </div>
        <div>
          <Label>Description</Label>
          <textarea rows={3} className="stg-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </div>
        <div>
          <Label>Color</Label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {COLORS.map((c) => (
              <button
                key={c} type="button" className={`stg-swatch${form.color === c ? " active" : ""}`}
                style={{ backgroundColor: c }} onClick={() => setField("color", c)} title={c}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Courses <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></Label>
          <CoursePickerField value={courses} onChange={setCourses} color={form.color} />
        </div>
      </div>
    </Modal>
  );
}

function PathwayCard({ pathway, onEdit, onDelete, courseNameById }) {
  const color = pathway.color || "#25476a";
  const hasDetails = !!pathway.description || pathway.courses?.length > 0;
  const [expanded, setExpanded] = useState(false);
  const isOpen = hasDetails && expanded;

  return (
    <div className="stg-item">
      <div
        className="stg-item-top"
        style={{ cursor: hasDetails ? "pointer" : "default" }}
        onClick={() => hasDetails && setExpanded((v) => !v)}
      >
        <div className="stg-item-dot" style={{ backgroundColor: color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stg-item-name">{pathway.name}</div>
        </div>
        {hasDetails && (
          <FiChevronDown
            size={14}
            strokeWidth={2}
            style={{ color: "#9CA3AF", flexShrink: 0, transition: "transform 0.15s", transform: isOpen ? "rotate(180deg)" : "none" }}
          />
        )}
        <button type="button" className="stg-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
          <FiEdit2 size={14} strokeWidth={2} />
        </button>
        <button type="button" className="stg-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
          <FiTrash2 size={14} strokeWidth={2} />
        </button>
      </div>

      {isOpen && (
        <>
          {pathway.description && <div className="stg-item-sub" style={{ marginTop: "8px" }}>{pathway.description}</div>}

          {pathway.courses?.length > 0 && (
            <div className="stg-course-section">
              <div className="stg-course-header">
                <div className="stg-course-header-left">
                  <FiBookOpen size={13} strokeWidth={2} style={{ color, flexShrink: 0 }} />
                  <span className="stg-course-title">Courses</span>
                </div>
                <span className="stg-course-count-badge" style={{ backgroundColor: `${color}12`, borderColor: `${color}35`, color }}>
                  {pathway.courses.length}
                </span>
              </div>
              <div className="stg-course-list">
                {pathway.courses.map((id) => (
                  <div key={id} className="stg-course-row">
                    <span className="stg-course-dot" style={{ backgroundColor: color }} />
                    <span className="stg-course-name">{courseNameById.get(id) || "Unknown course"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PathwayTemplatesPanel() {
  const { data: pathways = [], isLoading } = usePathwayTemplates();
  const { mutate: deletePathway } = useDeletePathwayTemplate();
  const { data: coursesResponse } = useCoursesQuery();
  const allCourses = coursesResponse?.data || [];
  const courseNameById = new Map(allCourses.map((c) => [c.id, c.name]));
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = query ? pathways.filter((p) => p.name.toLowerCase().includes(query)) : pathways;

  if (isLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Pathways</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {pathways.length} pathway{pathways.length !== 1 ? "s" : ""} defined — a curriculum imports a copy, so local edits never change the template
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          + Add Pathway
        </button>
      </div>

      {pathways.length === 0 ? (
        <div className="stg-empty">
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiFolder size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No pathway templates yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Build a reusable pathway here so any curriculum can import it as a starting point.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            + Add Pathway
          </button>
        </div>
      ) : (
        <>
          <div className="stg-search-wrap">
            <FiSearch size={14} className="stg-search-icon" />
            <input
              className="stg-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${pathways.length} pathway${pathways.length !== 1 ? "s" : ""}…`}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: "10px", color: "#25476a" }}>
                <FiSearch size={32} strokeWidth={1.8} />
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>No matches for "{search}"</p>
            </div>
          ) : (
            <div className="stg-list">
              {filtered.map((pw) => (
                <PathwayCard
                  key={pw.id}
                  pathway={pw}
                  onEdit={() => { setEditTarget(pw); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(pw)}
                  courseNameById={courseNameById}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && <PathwayModal editTarget={editTarget} onClose={() => setModalOpen(false)} />}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Pathway"
        message={`"${deleteTarget?.name}" will be removed from the template library. Copies already imported into curricula are unaffected. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { deletePathway(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
