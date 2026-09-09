import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { adminsApi } from "../services/adminsApi";

// No query/list hook here — see adminsApi.js's comment; this module only ever creates.
export function useCreateAdmin() {
  return useMutation({
    mutationFn: adminsApi.createAdmin,
    onSuccess: (admin) => toast.success(`Admin account created for ${admin.email}`),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create admin"),
  });
}

export function useReassignOwner() {
  return useMutation({
    mutationFn: adminsApi.reassignOwner,
    onSuccess: (result) => toast.success(`Moved to ${result.movedTo.email}`),
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to reassign"),
  });
}
