const API = import.meta.env.VITE_API_URL;

export function fetchApprovalBids(product, status) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("dashboard") !== "1") {
    return fetch(`${API}/${product}-bids/list/?status=${status}&role=admin`);
  }
  const filters = new URLSearchParams({ status, detail: "1" });
  if (params.get("user")) filters.set("user", params.get("user"));
  else if (params.get("analyser")) filters.set("analyser", params.get("analyser"));
  const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
  return fetch(`${API}/admin/dashboard/${product}/bids/?${filters}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

