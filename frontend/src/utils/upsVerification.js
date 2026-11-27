export const verificationValue = value => JSON.stringify(value ?? "");

export function upsVerificationFields(bid, fields, specs) {
  if (!bid) return [];
  const metadata = ["bid_no", "dept_name", "organization", "qty", "pincode", "address"]
    .map(key => ({ key: `meta.${key}`, value: bid[key] }));
  for (const key of ["model_number", "atc", "start_date", "end_date"]) {
    if (String(bid[key] ?? "").trim()) metadata.push({ key: `meta.${key}`, value: bid[key] });
  }
  return [...metadata, ...fields.filter(field => field.required || (Array.isArray(specs[field.key]) ? specs[field.key].length > 0 : String(specs[field.key] ?? "").trim() !== ""))
    .map(field => ({ key: `spec.${field.key}`, value: specs[field.key] }))];
}
