import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCourseQuery } from "../hooks/useCourse";

const TABS = [
  { key: "outcomes",     label: "Outcomes" },
  { key: "introduction", label: "Introduction" },
  { key: "mainConcept",  label: "Main Concept" },
  { key: "activities",   label: "Activities" },
  { key: "teachersNote", label: "Teacher's Note" },
];

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

// TipTap's "empty" state is still markup (e.g. "<p></p>"), not an empty string —
// strip tags before deciding whether there's anything to show.
function isEmptyHtml(html) {
  if (!html) return true;
  if (/<img[\s>]/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

// Content here was authored by the same user through RichTextEditor (internal tool,
// no untrusted third-party input), so rendering raw HTML without a sanitizer is fine.
function RichContent({ html, emptyText }) {
  if (isEmptyHtml(html)) {
    return <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>{emptyText}</p>;
  }
  return (
    <>
      <style>{`
        .course-rich-content { font-size: 14px; color: #374151; line-height: 1.65; }
        .course-rich-content p { margin: 0 0 10px; }
        .course-rich-content p:last-child { margin-bottom: 0; }
        .course-rich-content ul, .course-rich-content ol { margin: 0 0 10px; padding-left: 22px; }
        .course-rich-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
        .course-rich-content strong { font-weight: 700; }
      `}</style>
      <div className="course-rich-content" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

function DetailBlock({ label, value }) {
  return (
    <div>
      {label && (
        <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
      )}
      <RichContent html={value} emptyText="Not added" />
    </div>
  );
}

function TabBar({ activeTab, onChange }) {
  return (
    <div style={{ display: "flex", gap: "6px", padding: "6px", backgroundColor: "#F9FAFB", borderRadius: "12px", flexWrap: "wrap" }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: "8px 16px",
              borderRadius: "9px",
              border: "none",
              fontSize: "13px",
              fontWeight: "700",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              backgroundColor: isActive ? "#25476a" : "transparent",
              color: isActive ? "#ffffff" : "#6B7280",
              transition: "background-color 0.15s, color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function TabContent({ tab, course }) {
  switch (tab) {
    case "outcomes":
      return (course.outcomes || []).length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
          {course.outcomes.map((outcome, idx) => (
            <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <span style={{ color: "#38aae1", fontSize: "13px", lineHeight: "1.5", flexShrink: 0 }}>●</span>
              <span style={{ fontSize: "14px", color: "#374151", lineHeight: "1.5" }}>{outcome}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No outcomes added</p>
      );

    case "introduction":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <DetailBlock label="Introduction" value={course.introduction?.overview} />
          <DetailBlock label="Ice Breaker" value={course.introduction?.iceBreaker} />
        </div>
      );

    case "mainConcept":
      return <DetailBlock value={course.mainConcept} />;

    case "activities":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <DetailBlock label="Class Activity" value={course.activities?.classActivity} />
          <DetailBlock label="Wrap Activity" value={course.activities?.wrapActivity} />
        </div>
      );

    case "teachersNote":
      return <DetailBlock value={course.teachersNote} />;

    default:
      return null;
  }
}

export default function CourseViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: course, isLoading, isError } = useCourseQuery(id);
  const [activeTab, setActiveTab] = useState("outcomes");

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading course…
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Course not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <button type="button" onClick={() => navigate("/courses")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
              Courses
            </button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "500" }}>{course.name}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
                📚
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.3px" }}>
                    {course.name}
                  </h1>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/courses/${id}/edit`)}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit Course
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Section title="Description">
          <RichContent html={course.description} emptyText="No description added" />
        </Section>

        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 0" }}>
            <TabBar activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <div style={{ padding: "20px" }}>
            <TabContent tab={activeTab} course={course} />
          </div>
        </div>
      </div>
    </div>
  );
}
