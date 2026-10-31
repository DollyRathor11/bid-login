import { useEffect, useState } from "react";

export default function useDailyActivity(product, user = "", analyser = "") {
  const [state, setState] = useState({ data: [], loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState(previous => ({ ...previous, loading: true, error: "" }));
      try {
        const params = new URLSearchParams({ product });
        if (user) params.set("user", user);
        else if (analyser) params.set("analyser", analyser);
        const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
        const response = await fetch(`${import.meta.env.VITE_API_URL}/dashboard/daily-activity/?${params}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) throw new Error("Daily activity could not be loaded. Please refresh and sign in again if needed.");
        if (!controller.signal.aborted) setState({ data, loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setState({ data: [], loading: false, error: error.message });
      }
    };
    load();
    const refresh = () => { if (document.visibilityState === "visible") load(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [product, user, analyser]);
  return state;
}
