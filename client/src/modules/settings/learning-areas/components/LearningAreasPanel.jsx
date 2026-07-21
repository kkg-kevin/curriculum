import { useState } from "react";
import { FiBookOpen, FiChevronDown, FiEdit2, FiFolder, FiMoreVertical, FiSearch, FiTrash2 } from "react-icons/fi";
import {
  useLearningAreas, useCreateLearningArea, useUpdateLearningArea, useDeleteLearningArea,
} from "../hooks/useLearningAreas";
import { Modal, Label } from "../../components/Modal";
import { PALETTE } from "../../palette";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import { useCoursesQuery } from "../../../courses/hooks/useCourse";
import CoursePickerField from "../../../courses/components/CoursePickerField";

const AREA_COLORS = PALETTE;

function LearningAreaModal({ editTarget, onClose }) {
  const { mutate: create, isPending: creating } = useCreateLearningArea();
  const { mutate: update, isPending: updating } = useUpdateLearningArea();
  const isPending = creating || updating;

  const [form, setForm] = useState(() => ({
    name: editTarget?.name || "",
    description: editTarget?.description || "",
    color: editTarget?.color || AREA_COLORS[0],
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
      title={editTarget ? "Edit Learning Area" : "Add Learning Area"}
      subtitle="Available for other modules to import as a starting point"
      onClose={onClose}
      footer={<>
        <button type="button" className="stg-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="stg-btn-primary" onClick={submit} disabled={isPending}>
          {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Learning Area"}
        </button>
      </>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "10px", color: "#EF4444", fontSize: "13px" }}>{error}</div>}
        <div>
          <Label>Name *</Label>
          <input className="stg-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Language & Literacy" />
        </div>
        <div>
          <Label>Description</Label>
          <textarea rows={3} className="stg-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
        </div>
        <div>
          <Label>Color</Label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {AREA_COLORS.map((c) => (
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

function LearningAreaCard({ area, onEdit, onDelete, courseNameById }) {
  const color = area.color || "#25476a";
  const hasDetails = !!area.description || area.courses?.length > 0;
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
          <div className="stg-item-name">{area.name}</div>
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
          {area.description && <div className="stg-item-sub" style={{ marginTop: "8px" }}>{area.description}</div>}

          {area.courses?.length > 0 && (
            <div className="stg-course-section">
              <div className="stg-course-header">
                <div className="stg-course-header-left">
                  <FiBookOpen size={13} strokeWidth={2} style={{ color, flexShrink: 0 }} />
                  <span className="stg-course-title">Courses</span>
                </div>
                <span className="stg-course-count-badge" style={{ backgroundColor: `${color}12`, borderColor: `${color}35`, color }}>
                  {area.courses.length}
                </span>
              </div>
              <div className="stg-course-list">
                {area.courses.map((id) => (
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

export default function LearningAreasPanel() {
  const { data: areas = [], isLoading } = useLearningAreas();
  const { mutate: deleteArea } = useDeleteLearningArea();
  const { data: coursesResponse } = useCoursesQuery();
  const allCourses = coursesResponse?.data || [];
  const courseNameById = new Map(allCourses.map((c) => [c.id, c.name]));
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredAreas = query ? areas.filter((a) => a.name.toLowerCase().includes(query)) : areas;

  if (isLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Learning Areas</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {areas.length} area{areas.length !== 1 ? "s" : ""} defined — modules import a copy, so local edits never change the default
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          + Add Learning Area
        </button>
      </div>

      {areas.length === 0 ? (
        <div className="stg-empty">
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiFolder size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No learning areas yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Define learning areas here so other modules can import them as a starting point.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            + Add Learning Area
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
              placeholder={`Search ${areas.length} learning area${areas.length !== 1 ? "s" : ""}…`}
            />
          </div>

          {filteredAreas.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: "10px", color: "#25476a" }}>
                <FiSearch size={32} strokeWidth={1.8} />
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>No matches for "{search}"</p>
            </div>
          ) : (
            <div className="stg-list">
              {filteredAreas.map((area) => (
                <LearningAreaCard
                  key={area.id}
                  area={area}
                  onEdit={() => { setEditTarget(area); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(area)}
                  courseNameById={courseNameById}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && <LearningAreaModal editTarget={editTarget} onClose={() => setModalOpen(false)} />}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Learning Area"
        message={`"${deleteTarget?.name}" will be removed from the catalog. Copies already imported into curricula or other modules are unaffected. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { deleteArea(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
