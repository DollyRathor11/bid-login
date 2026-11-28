import { getUpsFields } from "./upsApi";

const controlClass = "w-full min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 disabled:bg-gray-50 disabled:text-gray-500";

export default function UpsConfig({ schema, type, specs, onChange, disabled = false, children, renderLabel, renderModelLabel, modelNumber, onModelChange }) {
  const fields = getUpsFields(schema, type, specs);
  const change = (key, value) => onChange({ ...specs, [key]: value });
  const orderedFields = [...fields.filter(f => f.kind !== "textarea" && f.kind !== "multi"), ...fields.filter(f => f.kind === "multi"), ...fields.filter(f => f.kind === "textarea")];
  return <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
      {onModelChange && <div>{renderModelLabel || <label htmlFor="ups-model-number" className="mb-1 block text-sm font-medium text-gray-700">Model Number</label>}<input id="ups-model-number" name="model_number" maxLength={150} value={modelNumber || ""} onChange={event => onModelChange(event.target.value)} disabled={disabled} placeholder="Enter Model Number" className={controlClass} /></div>}
      {orderedFields.map(field => <div key={field.key} className={field.kind === "textarea" || field.kind === "multi" ? "col-span-1 md:col-span-2 lg:col-span-3" : "col-span-1"}>
        {renderLabel ? renderLabel(field) : <div className="mb-1 flex items-center gap-2"><label htmlFor={`ups-${field.key}`} className="block text-sm font-medium text-gray-700">{field.label}</label>{!field.required && <span className="text-[11px] font-normal text-red-500">*Optional</span>}</div>}
        {field.kind === "textarea" ? <textarea id={`ups-${field.key}`} disabled={disabled} rows={2} maxLength={5000} value={specs[field.key] || ""} onChange={e => change(field.key, e.target.value)} placeholder="Technical details..." className={`${controlClass} resize-none`} />
          : field.kind === "multi" ? <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-gray-300 bg-white p-3 md:grid-cols-2">{field.options.map(option => <label key={option} className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" disabled={disabled} checked={(specs[field.key] || []).includes(option)} onChange={e => change(field.key, e.target.checked ? [...(specs[field.key] || []), option] : (specs[field.key] || []).filter(v => v !== option))} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />{option}
          </label>)}</div>
          : field.options.length > 0 ? <select id={`ups-${field.key}`} name={field.key} required={field.required} disabled={disabled} value={specs[field.key] || ""} onChange={e => change(field.key, e.target.value)} className={controlClass}>
            <option value="">Select</option>
            {specs[field.key] && !field.options.includes(specs[field.key]) && <option value={specs[field.key]}>{specs[field.key]}</option>}
            {field.options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          : <input id={`ups-${field.key}`} name={field.key} required={field.required} disabled={disabled} maxLength={5000} value={specs[field.key] || ""} onChange={e => change(field.key, e.target.value)} placeholder="Enter value" className={controlClass} />}
      </div>)}
      {children}
  </div>;
}
