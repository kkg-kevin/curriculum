import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiArrowLeft } from "react-icons/fi";
import { homeLearningApi } from "../services/homeLearningApi";
import TimetablePage from "../../school-portal/pages/TimetablePage";

// A home-schooled child's weekly timetable. Each child has their own class in the Home Learning
// hub, so this is the hub portal's timetable editor opened on that hub and that child's class.
export default function HomeLearningTimetablePage() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("class") || "";
  const { data: hub, isLoading, isError } = useQuery({ queryKey: ["home-learning", "hub"], queryFn: homeLearningApi.getHub });
  // The household cards show each child's lesson count — refresh them when leaving this screen.
  const queryClient = useQueryClient();
  useEffect(() => () => { queryClient.invalidateQueries({ queryKey: ["home-learning"], exact: true }); }, [queryClient]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Link to="/home-learning" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#25476a", fontSize: 13, fontWeight: 700, textDecoration: "none", width: "fit-content" }}>
        <FiArrowLeft /> Back to Home Learning
      </Link>
      {isLoading
        ? <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
        : isError || !hub
          ? <div style={{ padding: "40px 20px", textAlign: "center", color: "#B91C1C", fontSize: 14 }}>Couldn't load the Home Learning hub.</div>
          : <TimetablePage
            key={classId}
            hub={hub}
            initialClassId={classId}
            heading="Home Learning timetable"
            intro="Each child's weekly lessons — set the day, time and course once and it repeats every week. The educator, the child and the parent all see these sessions on their timetables."
          />}
    </div>
  );
}
