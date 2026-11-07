import { useEffect, useState } from "react";

// Refresh configuration lists when opened and when returning from another tab.
export default function useComponentOptions(loadRates) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      try {
        const { loadComponentOptions } = await import("../utils/componentOptions");
        await Promise.all([loadComponentOptions(), loadRates()]);
        if (active) setRevision((value) => value + 1);
      } catch (error) {
        console.error("Component options:", error);
      } finally {
        refreshing = false;
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [loadRates]);
  return revision;
}
