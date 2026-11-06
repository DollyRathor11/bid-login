export function fillMissingApprovalPrices(form, pairs, rates) {
  const next = { ...form };
  let changed = false;
  for (const [field, priceField] of pairs) {
    const choice = String(form[field] ?? "").trim();
    const price = Number(String(form[priceField] ?? "").replace(/,/g, "").trim());
    if (!choice || choice.toLowerCase() === "none" || (Number.isFinite(price) && price > 0)) continue;
    if (field === "motherboard" && choice.startsWith("Integrated") && price === 0) continue;
    const category = field === "ssd1" || field === "ssd2" ? "ssd" : field;
    const rate = rates.find(item => item.category === category && item.name === choice);
    const value = Number(rate?.price);
    if (Number.isFinite(value) && value > 0) { next[priceField] = value; changed = true; }
  }
  return changed ? next : form;
}

export function epbgPriceError(form) {
  const text = String(form.epbg ?? "").trim().replace(/%$/, "").trim();
  if (!text) return { field: "epbg", message: "Please enter EPBG percentage: 0, a positive number, or NA." };
  if (["na", "n/a", "n.a", "n.a.", "not applicable"].includes(text.toLowerCase())) return null;
  const percentage = Number(text);
  if (!Number.isFinite(percentage) || percentage < 0) return { field: "epbg", message: "Please enter a valid EPBG percentage or NA." };
  if (percentage === 0) return null;
  const price = Number(String(form.epbg_price ?? "").replace(/,/g, "").trim());
  return Number.isFinite(price) && price > 0 ? null : { field: "epbg_price", message: "Please enter an EPBG price greater than 0 when EPBG percentage is greater than 0." };
}
