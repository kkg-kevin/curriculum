import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArchive, FiCopy, FiEdit2, FiPlus, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useQaMutation, useQaTemplates } from "../hooks/useQa";
import { qaApi } from "../services/qaApi";
import { Empty, Pill, Segmented, T, btn, card, formatDate, hint, toolbar, useQaBase } from "../shared";

// The workspace's templates — what a visit checks. Anyone who reviews can make one and use any;
// the person who made it (or an admin) changes, archives or deletes it. One in use can't be
// deleted — archive it instead (reports keep their own copy either way).
export default function TemplatesTab() {
  const base = useQaBase();
  const navigate = useNavigate();
  const [status, setStatus] = useState("active");
  const [deleting, setDeleting] = useState(null);
  const { data = [], isLoading, isError, error } = useQaTemplates({ status });
  const setTemplateStatus = useQaMutation(({ id, next }) => qaApi.setTemplateStatus(id, next), (r) => (r.status === "archived" ? "Template archived" : "Template back in use"));
  const remove = useQaMutation((id) => qaApi.deleteTemplate(id), "Template deleted");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}>
        <Segmented label="Show" options={[{ key: "active", label: "In use" }, { key: "archived", label: "Archived" }]} value={status} onChange={setStatus} />
        <button type="button" className="ci-btn" onClick={() => navigate(`${base}/templates/new`)} style={btn("primary")}><FiPlus size={15} /> New template</button>
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Templates couldn't be loaded."}</p>}
        {!isLoading && data.length === 0 && (
          <Empty title={status === "active" ? "No templates yet" : "No archived templates"}>
            {status === "active" ? "A template lists what a visit checks — like how the lesson is prepared, taught and managed." : null}
          </Empty>
        )}
        {data.map((t) => (
          <div key={t.id} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "14px 18px", borderTop: "1px solid #F3F4F6" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link to={`${base}/templates/${t.id}`} style={{ fontSize: 14, fontWeight: 800, color: T.ink, textDecoration: "none" }}>{t.name}</Link>
                {t.status === "archived" && <Pill look={{ bg: "#F3F4F6", color: "#6B7280" }}>Archived</Pill>}
              </div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: T.inkMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>{t.sectionCount} {t.sectionCount === 1 ? "section" : "sections"} · {t.itemCount} {t.itemCount === 1 ? "item" : "items"}</span>
                <span>Used on {t.visits} {t.visits === 1 ? "visit" : "visits"}{t.schedules ? ` · ${t.schedules} active ${t.schedules === 1 ? "schedule" : "schedules"}` : ""}</span>
                {t.createdByName && <span>By {t.createdByName}</span>}
                <span>Updated {formatDate(t.updatedAt, { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
              <button type="button" className="ci-btn" onClick={() => navigate(`${base}/templates/new?from=${t.id}`)} style={btn("secondary", { size: "sm" })}><FiCopy size={13} /> Copy</button>
              {t.canEdit && (
                <>
                  <button type="button" className="ci-btn" onClick={() => navigate(`${base}/templates/${t.id}`)} style={btn("secondary", { size: "sm" })}><FiEdit2 size={13} /> Edit</button>
                  <button
                    type="button"
                    className="ci-btn"
                    disabled={setTemplateStatus.isPending}
                    onClick={() => setTemplateStatus.mutate({ id: t.id, next: t.status === "active" ? "archived" : "active" })}
                    style={btn("secondary", { size: "sm", disabled: setTemplateStatus.isPending })}
                  >
                    {t.status === "active" ? <><FiArchive size={13} /> Archive</> : <><FiRotateCcw size={13} /> Use again</>}
                  </button>
                  <button type="button" className="ci-btn" onClick={() => setDeleting(t)} style={btn("danger", { size: "sm" })}><FiTrash2 size={13} /> Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
      </section>
      <ConfirmDialog
        isOpen={!!deleting}
        title="Delete template"
        message={`"${deleting?.name}" will be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        usageCheck={deleting ? () => qaApi.checkDeleteTemplate(deleting.id) : undefined}
        onAlternative={deleting && deleting.status === "active" ? () => { setTemplateStatus.mutate({ id: deleting.id, next: "archived" }); setDeleting(null); } : undefined}
        onConfirm={() => { remove.mutate(deleting.id); setDeleting(null); }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
