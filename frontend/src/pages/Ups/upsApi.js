export const UPS_API = import.meta.env.VITE_API_URL;

export async function upsRequest(path, options = {}) {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
  const response = await fetch(`${UPS_API}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to load this bid. Please try again.");
  return data;
}

export const upsInputClass = "w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50";
export const upsButtonClass = "rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50";

export function getUpsFields(schema, type, specs) {
  const selected = schema.types[type];
  const fields = specs.capacity_range === "above_10" && selected.large_fields ? selected.large_fields : selected.fields;
  const removedFields = new Set([
    "salient_features", "protections", "compliance", "additional_specs", "special_terms",
    "description", "accessories", "protection_details", "metering", "alarms",
  ]);
  if (type === "line_interactive") {
    ["avr_variation", "environmental_reports", "test_report", "furnish_reports", "bis", "vah"].forEach(key => removedFields.add(key));
  }
  if (type === "online_with_battery") {
    ["efficiency", "humidity", "test_report", "furnish_reports", "bis"].forEach(key => removedFields.add(key));
  }
  if (type === "online_without_battery") {
    ["humidity", "test_report", "furnish_reports", "bis"].forEach(key => removedFields.add(key));
  }
  return fields.filter(field => !removedFields.has(field.key));
}
