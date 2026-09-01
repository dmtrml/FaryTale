"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline support is progressive enhancement; reading online must continue
      // even if registration is unavailable in the current browser/environment.
    });
  }, []);

  return null;
}
