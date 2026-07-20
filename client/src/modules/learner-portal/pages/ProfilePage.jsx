import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { classApi } from "../../classes/services/classApi";
import { locationApi as schoolApi } from "../../locations/services/locationApi";
import { useUpdateLearner } from "../../learners/hooks/useLearners";

const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  tintBorder: "#a8d5ee",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
};

function cardStyle() {
  return {
    backgroundColor: "#fff",
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: `1px solid ${T.border}`,
  };
}

export default function LearnerProfilePage() {
  const { user } = useAuth();
  const { mutate: updateLearner, isPending } = useUpdateLearner();

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  const { data: cls, isLoading: classLoading } = useQuery({
    queryKey: ["classes", "detail", learner?.classId],
    queryFn: () => classApi.getById(learner.classId),
    enabled: !!learner?.classId,
  });

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "detail", cls?.schoolId],
    queryFn: () => schoolApi.getById(cls.schoolId),
    enabled: !!cls?.schoolId,
  });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (learner) {
      setFormData({
        firstName: learner.firstName || "",
        lastName: learner.lastName || "",
        gender: learner.gender || "",
        guardianName: learner.guardianName || "",
        guardianPhone: learner.guardianPhone || "",
        guardianEmail: learner.guardianEmail || "",
      });
    }
  }, [learner]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {};
    if (!formData.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) nextErrors.lastName = "Last name is required";
    if (!formData.gender) nextErrors.gender = "Gender is required";
    if (!formData.guardianName.trim()) nextErrors.guardianName = "Guardian name is required";
    if (!formData.guardianPhone.trim()) nextErrors.guardianPhone = "Guardian phone is required";
    if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
      nextErrors.guardianEmail = "Enter a valid email";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    updateLearner({
      id: learner.id,
      data: {
        ...formData,
        schoolId: learner.schoolId,
        classId: learner.classId,
        status: learner.status || "active",
      },
    });
  };

  const isLoading = learnerLoading || (!!learner && (classLoading || schoolLoading));

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }

  if (!learner) {
    return (
      <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learner profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask your school to connect this account to a learner record.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Profile</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 640 }}>Update your learner details and guardian contact information.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <form onSubmit={handleSubmit} style={{ ...cardStyle(), padding: "24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink }}>First name</label>
              <input name="firstName" value={formData.firstName} onChange={handleChange} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.firstName ? "#ef4444" : T.border}`, fontSize: 14 }} />
              {errors.firstName && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.firstName}</p>}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink }}>Last name</label>
              <input name="lastName" value={formData.lastName} onChange={handleChange} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.lastName ? "#ef4444" : T.border}`, fontSize: 14 }} />
              {errors.lastName && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink }}>Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.gender ? "#ef4444" : T.border}`, fontSize: 14, backgroundColor: "#fff" }}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {errors.gender && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.gender}</p>}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink }}>Guardian name</label>
            <input name="guardianName" value={formData.guardianName} onChange={handleChange} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.guardianName ? "#ef4444" : T.border}`, fontSize: 14 }} />
            {errors.guardianName && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.guardianName}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink }}>Guardian phone</label>
              <input name="guardianPhone" value={formData.guardianPhone} onChange={handleChange} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.guardianPhone ? "#ef4444" : T.border}`, fontSize: 14 }} />
              {errors.guardianPhone && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.guardianPhone}</p>}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink }}>Guardian email</label>
              <input name="guardianEmail" type="email" value={formData.guardianEmail} onChange={handleChange} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.guardianEmail ? "#ef4444" : T.border}`, fontSize: 14 }} />
              {errors.guardianEmail && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>{errors.guardianEmail}</p>}
            </div>
          </div>

          <button type="submit" disabled={isPending} style={{ alignSelf: "flex-start", padding: "10px 18px", backgroundColor: isPending ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer" }}>
            {isPending ? "Saving…" : "Save profile"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cardStyle(), padding: "20px 22px" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current record</p>
            <p style={{ margin: "10px 0 4px", fontSize: 18, fontWeight: 800, color: T.ink }}>{learner.firstName} {learner.lastName}</p>
            <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>{cls?.gradeName || "Class"} · {school?.name || "School"}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: T.inkMuted }}>Status: {learner.status || "active"}</p>
          </div>

          <div style={{ ...cardStyle(), padding: "20px 22px" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Need help?</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: T.inkMuted }}>If your class or school details are wrong, ask the school admin to update the learner record.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
