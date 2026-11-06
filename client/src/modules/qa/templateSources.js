import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { qaApi } from "./services/qaApi";
import { checkinsApi } from "../checkins/services/checkinsApi";

// Templates are one feature used in two places (6 Nov 2026): quality assurance visits, and hub
// check-ins — the same sections, items (yes / no, rubric, comment), guidance and scoring
// (server: qa.rules.js). The template list (TemplatesTab) and editor (TemplateEditorPage) take a
// `source` — "qa" or "checkins" — for where they save and how they're worded.

const errorText = (err) => err?.errors?.[0]?.message || err?.message || "Something went wrong";

export const TEMPLATE_SOURCES = {
  qa: {
    key: ["qa"],
    api: {
      list: qaApi.templates, get: qaApi.template, create: qaApi.createTemplate, update: qaApi.updateTemplate,
      setStatus: qaApi.setTemplateStatus, remove: qaApi.deleteTemplate, checkDelete: qaApi.checkDeleteTemplate,
    },
    // A sent QA report moves the educator's profile figures.
    alsoRefresh: [["educator-profile"]],
    words: {
      use: "visit", uses: "visits",
      empty: "A template lists what a visit checks — like how the lesson is prepared, taught and managed.",
      namePlaceholder: "e.g. Classroom observation",
      itemPlaceholder: "What to check — e.g. Starts the lesson on time",
      sectionPlaceholder: "e.g. Preparation",
      descriptionHelp: "What this template is for and how to use it — reviewers see it at the top of every review.",
      guidance: "Guidance for the reviewer — what to look for, examples, what good looks like",
      addGuidance: "Add guidance for the reviewer",
      changes: "Changes apply to visits whose review hasn't been started. Reports already begun keep the version they were written on.",
    },
    example: (item, section) => ({
      name: "Classroom observation",
      description: "<p>How a lesson is prepared, taught and managed. Sit in for the whole lesson where you can.</p>",
      sections: [
        section("Preparation", [
          item("Lesson plan is ready and follows the curriculum", "yes_no"),
          item("Materials, devices and kits are ready before learners arrive", "yes_no"),
          item("The lesson's objective is shared with learners", "yes_no"),
        ]),
        section("Teaching", [
          item("Explains concepts clearly, at the learners' level", "rubric"),
          item("Checks understanding during the lesson", "rubric", "Questions, quick checks, walking round."),
          item("Every learner gets hands-on time", "rubric"),
        ]),
        section("Class management", [
          item("Starts and ends on time", "yes_no"),
          item("Learners are engaged and on task", "rubric"),
          item("Devices and kits are handled safely and packed away", "yes_no"),
        ]),
        section("Notes", [item("Anything else observed", "comment")]),
      ],
    }),
  },
  checkins: {
    key: ["checkins"],
    api: {
      list: checkinsApi.templates, get: checkinsApi.template, create: checkinsApi.createTemplate, update: checkinsApi.updateTemplate,
      setStatus: checkinsApi.setTemplateStatus, remove: checkinsApi.deleteTemplate, checkDelete: checkinsApi.checkDeleteTemplate,
    },
    alsoRefresh: [],
    words: {
      use: "check-in", uses: "check-ins",
      empty: "A template lists what a check-in covers — like how the hub is run, its learners, educators and facilities. Pick one when you set up a hub's check-ins.",
      namePlaceholder: "e.g. Monthly hub check-in",
      itemPlaceholder: "What to check — e.g. Attendance registers are up to date",
      sectionPlaceholder: "e.g. Learners and attendance",
      descriptionHelp: "What this template is for and how to use it — whoever writes the report sees it at the top.",
      guidance: "Guidance for whoever writes the report — what to look for, examples, what good looks like",
      addGuidance: "Add guidance for the report",
      changes: "Changes apply to check-ins not reported yet. Reports already sent keep the version they were written on.",
    },
    example: (item, section) => ({
      name: "Monthly hub check-in",
      description: "<p>How the hub is running this month — go through it together with the hub, then add the highs, lows and resolutions.</p>",
      sections: [
        section("Learners and attendance", [
          item("Attendance is marked for every session", "yes_no"),
          item("Learner numbers are on target for the term", "rubric"),
          item("Learners who missed sessions have been followed up", "yes_no"),
        ]),
        section("Educators and teaching", [
          item("Every class has its educator for each session", "yes_no"),
          item("Sessions follow the curriculum and the timetable", "rubric"),
          item("Assessments are issued and marked on time", "rubric", "Look at the Needs Grading lists and the reports."),
        ]),
        section("Facilities and devices", [
          item("Devices and kits are working and accounted for", "rubric"),
          item("The room is safe, clean and set up for learning", "yes_no"),
        ]),
        section("Parents and the hub", [
          item("Parents get reports and hear about their child's progress", "rubric"),
          item("Invoices and payments are up to date", "yes_no"),
          item("Anything the hub needs from us", "comment"),
        ]),
      ],
    }),
  },
};

export const templateSource = (name) => TEMPLATE_SOURCES[name] || TEMPLATE_SOURCES.qa;

// Same cache keys as useQa.js's useQaTemplates / useQaTemplate, so QA's other screens share them.
export const useSourceTemplates = (source, params = {}, { enabled = true } = {}) =>
  useQuery({ queryKey: [...source.key, "templates", params], queryFn: () => source.api.list(params), enabled });
export const useSourceTemplate = (source, id) =>
  useQuery({ queryKey: [...source.key, "template", id], queryFn: () => source.api.get(id), enabled: !!id });

export function useSourceMutation(source, mutationFn, success) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: source.key });
      source.alsoRefresh.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      const message = typeof success === "function" ? success(result, variables) : success;
      if (message) toast.success(message);
    },
    onError: (err) => toast.error(errorText(err)),
  });
}
