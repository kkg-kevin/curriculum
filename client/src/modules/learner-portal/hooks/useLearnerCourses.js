import { useMemo } from "react";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { usePathway } from "../../curriculum/hooks/useCompetencies";

// A learner's courses: their class grade's courses in the curriculum's live version, plus the
// courses of every pathway they're on — the automatic (stage) one and any staff assigned by hand
// (CompetencyService.getPathway). Pathway courses come from the same live version, so a course
// that isn't published in it isn't listed (nor could the learner open it). Same { data,
// isLoading } shape as useCurriculumCurrentCourses, which every learner-portal page used before.
export function useLearnerCourses(curriculumId, gradeId, learnerId) {
  const { data: gradeCourses, isLoading: gradeLoading } = useCurriculumCurrentCourses(curriculumId, gradeId);
  const { data: pathways = [], isLoading: pathwaysLoading } = usePathway(curriculumId, learnerId);
  const pathwayCourseIds = useMemo(() => new Set(pathways.flatMap((p) => p.courseIds || [])), [pathways]);
  // Every grade's courses — only fetched when a pathway has courses to look up.
  const { data: allCourses, isLoading: allLoading } = useCurriculumCurrentCourses(pathwayCourseIds.size > 0 ? curriculumId : undefined);

  const data = useMemo(() => {
    if (!gradeCourses) return gradeCourses;
    const inGrade = new Set(gradeCourses.map((c) => c.id));
    const extra = (allCourses || []).filter((c) => pathwayCourseIds.has(c.id) && !inGrade.has(c.id));
    return [...gradeCourses, ...extra];
  }, [gradeCourses, allCourses, pathwayCourseIds]);

  return {
    data,
    isLoading: gradeLoading || (!!curriculumId && !!learnerId && pathwaysLoading) || (pathwayCourseIds.size > 0 && allLoading),
  };
}
