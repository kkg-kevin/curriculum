import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../../services/api";

// Settings → Payments: the workspace's own M-Pesa Paybill (server: payments/mpesa/mpesa.account-settings.js).
const BASE = "/api/payment-settings";

export const paymentSettingsApi = {
  get: () => api.get(BASE).then((r) => r.data.data),
  save: (data) => api.put(BASE, data).then((r) => r.data.data),
  remove: () => api.delete(BASE).then((r) => r.data.data),
  test: () => api.post(`${BASE}/test`).then((r) => r.data.data),
  registerUrls: () => api.post(`${BASE}/register-urls`).then((r) => r.data.data),
  // How families can pay (server: payments/payment-options.js).
  getOptions: () => api.get(`${BASE}/options`).then((r) => r.data.data),
  saveOptions: (options) => api.put(`${BASE}/options`, options).then((r) => r.data.data),
};

const KEY = ["payment-settings"];
const errorText = (err) => err.response?.data?.message || err.message || "Something went wrong";

export function usePaymentSettings() {
  return useQuery({ queryKey: KEY, queryFn: paymentSettingsApi.get });
}

function useSettingsMutation(mutationFn, { success, pick = (d) => d } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      qc.setQueryData(KEY, pick(data));
      // The Paybill shown on invoices and in Billing → M-Pesa may have changed.
      qc.invalidateQueries({ queryKey: ["billing"] });
      if (data?.warning) toast(data.warning, { icon: "⚠️", duration: 8000 });
      else if (success) toast.success(success);
    },
    onError: (err) => toast.error(errorText(err)),
  });
}

export const useSavePaymentSettings = () => useSettingsMutation(paymentSettingsApi.save, { success: "Payment settings saved" });
export const useRemovePaymentSettings = () => useSettingsMutation(paymentSettingsApi.remove, { success: "Your own Paybill was removed" });
export const useRegisterPaybillUrls = () => useSettingsMutation(paymentSettingsApi.registerUrls, { success: "Safaricom registered the Paybill URLs", pick: (d) => d.settings });

export function useTestPaymentKeys() {
  return useMutation({ mutationFn: paymentSettingsApi.test, onError: (err) => toast.error(errorText(err)) });
}

const OPTIONS_KEY = ["payment-settings", "options"];

export function usePaymentOptions({ enabled = true } = {}) {
  return useQuery({ queryKey: OPTIONS_KEY, queryFn: paymentSettingsApi.getOptions, enabled });
}

export function useSavePaymentOptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentSettingsApi.saveOptions,
    onSuccess: (data) => {
      qc.setQueryData(OPTIONS_KEY, data);
      toast.success("Payment methods saved");
    },
    onError: (err) => toast.error(errorText(err)),
  });
}
