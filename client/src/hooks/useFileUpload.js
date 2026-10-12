import { useCallback, useEffect, useRef, useState } from "react";
import { uploadApi } from "../services/uploadApi";
import { noteUserActivity } from "../context/session";

// One file upload for a screen: `upload(file)` resolves with the uploaded file ({ url, filename,
// mimeType, size }) and `progress` ({ name, loaded, total, percent }, or null when idle) drives
// components/UploadProgress.jsx. `cancel()` stops it; the promise then rejects with an error
// whose `cancelled` is true, which callers should not report as a failure.
//
// While a file is going up the browser warns before the page is closed, and the user counts as
// active (a long upload is not an idle session, even with the tab in the background).
export function useFileUpload() {
  const [progress, setProgress] = useState(null);
  const controller = useRef(null);
  const uploading = progress !== null;

  const upload = useCallback(async (file) => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setProgress({ name: file.name, loaded: 0, total: file.size, percent: 0 });
    try {
      return await uploadApi.uploadDocument(file, {
        signal: own.signal,
        onProgress: (p) => { if (controller.current === own) setProgress({ name: file.name, ...p }); },
      });
    } finally {
      if (controller.current === own) {
        controller.current = null;
        setProgress(null);
      }
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);

  // Leaving the screen stops the upload with it.
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!uploading) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    noteUserActivity();
    const interval = setInterval(noteUserActivity, 60 * 1000);
    return () => {
      window.removeEventListener("beforeunload", warn);
      clearInterval(interval);
    };
  }, [uploading]);

  return { upload, cancel, uploading, progress };
}
