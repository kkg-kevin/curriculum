import { useCallback, useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../../services/api";
import { tidy } from "../utils";

// A mentor's weekly hours and how they sit against what's really on (teachers/:id/availability).
const KEY = (teacherId) => ["availability", teacherId];
const base = (teacherId) => `/api/teachers/${teacherId}/availability`;

export const useAvailabilityWeek = (teacherId, from, { enabled = true } = {}) => useQuery({
  queryKey: [...KEY(teacherId), "week", from || "current"],
  queryFn: () => api.get(`${base(teacherId)}/week`, { params: from ? { from } : {} }).then((r) => r.data.data),
  enabled: enabled && !!teacherId,
  placeholderData: keepPreviousData,
});

export const useAvailabilityStatus = (teacherId) => useQuery({
  queryKey: [...KEY(teacherId), "status"],
  queryFn: () => api.get(`${base(teacherId)}/status`).then((r) => r.data.data),
  enabled: !!teacherId,
  staleTime: 60000,
});

// Editing the hours: the screen changes at once and the whole pattern is saved behind it. Saves run
// one at a time and only the newest waiting one is sent, so quick edits can't land out of order.
export function useHoursEditor(teacherId, saved) {
  const qc = useQueryClient();
  const [local, setLocal] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const waiting = useRef(null);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const windows = local ?? saved ?? [];

  const flush = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSaving(true);
    try {
      do {
        while (waiting.current) {
          const next = waiting.current;
          waiting.current = null;
          await api.put(base(teacherId), { windows: next.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })) });
        }
        await qc.invalidateQueries({ queryKey: KEY(teacherId) });
      } while (waiting.current);
      if (alive.current) setLocal(null);
    } catch (err) {
      waiting.current = null;
      toast.error(err.response?.data?.message || err.message || "Couldn't save your hours");
      await qc.invalidateQueries({ queryKey: KEY(teacherId) });
      if (alive.current) setLocal(null);
    } finally {
      running.current = false;
      if (alive.current) setSaving(false);
    }
  }, [qc, teacherId]);

  const apply = useCallback((next) => {
    const clean = tidy(next);
    setHistory((h) => [...h.slice(-19), windows]);
    setLocal(clean);
    waiting.current = clean;
    flush();
  }, [flush, windows]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const previous = h[h.length - 1];
      setLocal(previous);
      waiting.current = previous;
      flush();
      return h.slice(0, -1);
    });
  }, [flush]);

  return { windows, editing: local != null, saving, apply, undo, canUndo: history.length > 0 };
}
