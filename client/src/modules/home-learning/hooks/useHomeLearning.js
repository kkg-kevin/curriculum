import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../../services/api";
import { homeLearningApi } from "../services/homeLearningApi";
import { errorMessage } from "../components/ui";
import { askConfirm } from "../../../components/ui/AskDialog";

// Data and actions shared by the Home Learning list, one family's page and Add household.
// Every household comes from the one list query, so opening a family from the list is instant.

export function useHouseholds() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["home-learning"], queryFn: homeLearningApi.getAll });
  return { households: Array.isArray(data) ? data : [], isLoading, isError };
}

// Packages are created and priced in Billing → Packages; here they're only picked from.
export function usePackages() {
  const { data, isLoading } = useQuery({ queryKey: ["home-learning", "packages"], queryFn: homeLearningApi.getPackages });
  const packages = Array.isArray(data) ? data : [];
  return { packages, isLoading, hasActive: packages.some((p) => p.status === "active") };
}

// What the household and child forms pick from: learners not yet in any household, curricula
// and active educators. Only the family page and Add household load these — not the list.
export function usePickLists(households) {
  const { data: learnerRows } = useQuery({ queryKey: ["home-learning", "learners"], queryFn: () => api.get("/api/learners").then((r) => r.data.data || []) });
  const { data: curriculumRows } = useQuery({ queryKey: ["home-learning", "curricula"], queryFn: () => api.get("/api/curricula").then((r) => r.data.data || []) });
  const { data: teacherRows } = useQuery({ queryKey: ["home-learning", "educators"], queryFn: () => api.get("/api/teachers").then((r) => r.data.data || []) });
  const learners = Array.isArray(learnerRows) ? learnerRows : [];
  // Children already placed in any household can't be picked again (the server refuses it too).
  const placed = useMemo(() => new Set(households.flatMap((h) => (h.learners || []).map((l) => l.learnerId))), [households]);
  return {
    learners,
    availableLearners: learners.filter((learner) => !placed.has(learner.id)),
    curricula: Array.isArray(curriculumRows) ? curriculumRows : [],
    educators: Array.isArray(teacherRows) ? teacherRows.filter((teacher) => (teacher.status || "active") === "active") : [],
  };
}

export function useInvoiceDueNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: homeLearningApi.generateDueInvoices,
    onSuccess: ({ created }) => { queryClient.invalidateQueries({ queryKey: ["home-learning"] }); toast.success(created ? `${created} invoice${created === 1 ? "" : "s"} issued` : "Nothing due — every household is invoiced up to today"); },
    onError: (error) => toast.error(errorMessage(error, "Could not raise invoices")),
  });
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: homeLearningApi.createHousehold,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["home-learning"] }),
    onError: (error) => toast.error(errorMessage(error, "Could not add household")),
  });
}

// Everything you can do to one household. `actions.x(…, done)` — `done` runs only on success
// (e.g. to close a form). `pending` says which request for this household is in flight.
export function useHouseholdActions(householdId) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["home-learning"] });
  const mutation = (mutationFn, success, failure) => ({
    mutationFn,
    onSuccess: (result) => { refresh(); if (success) toast.success(typeof success === "function" ? success(result) : success); },
    onError: (error) => toast.error(errorMessage(error, failure)),
  });
  const update = useMutation(mutation(({ id, data }) => homeLearningApi.updateHousehold(id, data), "Household updated", "Could not update household"));
  const enroll = useMutation(mutation(({ householdId: id, ...data }) => homeLearningApi.enrollLearner(id, data), "Home Learning assignment saved", "Could not save assignment"));
  const createLearner = useMutation(mutation(({ householdId: id, ...data }) => homeLearningApi.createLearner(id, data), "Learner registered and assigned", "Could not register learner"));
  const remove = useMutation(mutation(({ householdId: id, learnerId }) => homeLearningApi.removeLearner(id, learnerId), "Removed from household — they can be re-added later", "Could not remove learner"));
  const invoice = useMutation(mutation(({ id, dueDate }) => homeLearningApi.generateInvoice(id, { dueDate }), ({ created, invoice: inv }) => (created ? `Invoice ${inv.invoiceNumber} issued` : `Already invoiced (${inv.invoiceNumber})`), "Could not raise invoice"));
  const approve = useMutation(mutation(({ id, data }) => homeLearningApi.approveSignup(id, data), "Payment approved — the family can now log in", "Could not approve the payment"));
  const decline = useMutation(mutation(homeLearningApi.declineSignup, "Sign-up declined", "Could not decline the sign-up"));

  const actions = {
    updateHousehold: (id, data, done) => update.mutate({ id, data }, { onSuccess: done }),
    saveEnrollment: (data, done) => {
      if (!data.learnerId || !data.curriculumId || !data.gradeId) return toast.error("Choose a learner, curriculum and grade first");
      enroll.mutate(data, { onSuccess: done });
    },
    createLearner: (data, done) => createLearner.mutate(data, { onSuccess: done }),
    removeLearner: async ({ householdId: id, learnerId, name }) => {
      if (await askConfirm({ title: `Remove ${name} from this household?`, message: "Their records are kept and they can be re-added later.", confirmLabel: "Remove", tone: "danger" })) remove.mutate({ householdId: id, learnerId });
    },
    invoice: (data) => invoice.mutate(data),
    approveSignup: (id, data, done) => approve.mutate({ id, data }, { onSuccess: done }),
    declineSignup: (id, done) => decline.mutate(id, { onSuccess: done }),
  };
  const pending = {
    updating: update.isPending && update.variables?.id === householdId,
    enrolling: enroll.isPending,
    creatingLearner: createLearner.isPending,
    invoicing: invoice.isPending,
    approving: approve.isPending,
    declining: decline.isPending,
  };
  return { actions, pending };
}
