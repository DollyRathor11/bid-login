export function catalogueProductId(product) {
  const id = product?.catalogue_id ?? product?.id;
  return /^\d+$/.test(String(id ?? "")) ? String(id) : null;
}

export function catalogueCategory(value, options) {
  return options.find(option => option.toLowerCase() === String(value || "").trim().toLowerCase()) || value || "";
}
