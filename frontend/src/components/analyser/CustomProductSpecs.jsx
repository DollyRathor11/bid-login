export default function CustomProductSpecs({ rows, onChange }) {
  const update = (index, key, value) => onChange(rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <section className="overflow-hidden rounded-2xl border bg-white">
    <div className="flex items-center justify-between gap-3 bg-slate-800 px-5 py-3"><h3 className="text-xs font-extrabold uppercase tracking-widest text-white">Additional Specifications</h3><button type="button" onClick={() => onChange([...rows, { label: "", value: "" }])} className="rounded-md border border-slate-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">+ Add Specification</button></div>
    <div className="space-y-4 bg-gray-50 p-5">{!rows.length && <p className="text-sm text-gray-500">Add a field such as Warranty for this product.</p>}{rows.map((row, index) => <div key={index} className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
      <label className="block text-xs font-bold text-gray-500">Field Name<input aria-label={`Specification ${index + 1} name`} maxLength={150} placeholder="e.g. Warranty" value={row.label} onChange={event => update(index, "label", event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" /></label>
      <label className="block text-xs font-bold text-gray-500">Value<input aria-label={`Specification ${index + 1} value`} maxLength={5000} placeholder="e.g. 3 Years" value={row.value} onChange={event => update(index, "value", event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" /></label>
      <button type="button" aria-label={`Remove specification ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))} className="rounded-lg border border-red-200 px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">Remove</button>
    </div>)}</div>
  </section>;
}
