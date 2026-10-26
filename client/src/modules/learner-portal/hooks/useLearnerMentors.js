import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";

// "My Teachers & Mentors" resolves every educator assigned to any course in each hub's
// class — real data via a small join, not a fabricated mentor list. A class can now have
// more than one educator (assigned per course), so this naturally becomes a richer list than
// the old single-class-teacher lookup. Hubs with no educators assigned are simply omitted.
// Built from the FULL hub list passed in, not just one selected hub — this list is meant to
// stay unscoped (every hub's educators), same as the hub list itself. `homeEducator`, when
// given, is the learner's Home Learning educator, added last.
// Used by the learner portal (useLearnerPortalScope) and by the learner's profile as staff see it.
export function useLearnerMentors(hubs, homeEducator = null) {
  const classIds = useMemo(() => [...new Set(hubs.map((h) => h.class?.id).filter(Boolean))], [hubs]);
  const { data: mentorLinks = [], isLoading: mentorLinksLoading } = useQuery({
    queryKey: ["learner-mentor-links", classIds],
    queryFn: () => Promise.all(classIds.map((id) => classApi.getCourseTeachers(id))).then((r) => r.flat()),
    enabled: classIds.length > 0,
  });
  const mentors = useMemo(() => {
    const seen = new Set();
    const result = [];
    hubs.forEach((h) => {
      if (!h.class?.id) return;
      const links = mentorLinks.filter((l) => l.classId === h.class.id);
      const uniqueTeacherIds = [...new Set(links.map((l) => l.teacherId))];
      uniqueTeacherIds.forEach((teacherId) => {
        const key = `${h.id}:${teacherId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const link = links.find((l) => l.teacherId === teacherId);
        if (link?.teacher) result.push({ teacher: link.teacher, hubName: h.name });
      });
    });
    if (homeEducator) {
      const key = `home:${homeEducator.id}`;
      if (!seen.has(key)) result.push({ teacher: homeEducator, hubName: "Home Learning" });
    }
    return result;
  }, [hubs, mentorLinks, homeEducator]);

  return { mentors, mentorsLoading: classIds.length > 0 && mentorLinksLoading };
}
