import UpsAnalyserComplianceDocuments from "./UpsAnalyserComplianceDocuments";
import UpsConfig from "../Ups/UpsConfig";
import { useEffect, useState } from "react";
import { getUpsFields } from "../Ups/upsApi";
import { upsVerificationFields, verificationValue } from "../../utils/upsVerification";

const inputClass = "w-full min-w-0 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50";

function VerificationLabel({ id, label, checked, onChange, showTick, disabled, optional = false }) {
  return <div className="mb-1 flex items-center justify-between gap-2"><label htmlFor={id} className="block text-sm font-semibold">{label}{optional && <span className="ml-1 text-[11px] font-normal text-red-500">*Optional</span>}</label>
    {showTick && <input type="checkbox" aria-label={`Verify ${label}`} title="Verify this field" checked={checked} disabled={disabled} onChange={onChange} className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded accent-green-600 focus:ring-green-500" />}
  </div>;
}

export default function AnalyserUpsReviewForm({ bidId, bid, schema, form, setForm, canEdit, saving, error, submit, onClose, embedded }) {
  const actor = sessionStorage.getItem("analyser_username") || sessionStorage.getItem("username") || "analyser";
  const verificationKey = `ups_verified_${actor}_${bidId}`;
  const [verified, setVerified] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(verificationKey) || "{}") || {}; } catch { return {}; }
  });
  useEffect(() => { try { sessionStorage.setItem(verificationKey, JSON.stringify(verified)); } catch { /* Verification still works when storage is unavailable. */ } }, [verificationKey, verified]);
  const specs = form.specs || {};
  const fields = bid && schema ? getUpsFields(schema, bid.ups_type, specs) : [];
  const requiredChecks = upsVerificationFields(bid ? form : null, fields, specs);
  const updateField = (name, value) => setForm(previous => ({ ...previous, [name]: value }));
  const isVerified = (key, value) => verified[key] === verificationValue(value);
  const verifiedCount = requiredChecks.filter(field => isVerified(field.key, field.value)).length;
  const allVerified = requiredChecks.length > 0 && verifiedCount === requiredChecks.length;
  const verificationLabel = (key, value, id, label, optional = false) => <VerificationLabel id={id} label={label} optional={optional}
    checked={isVerified(key, value)} showTick={canEdit} disabled={saving}
    onChange={() => setVerified(previous => { const next = { ...previous }; if (previous[key] === verificationValue(value)) delete next[key]; else next[key] = verificationValue(value); return next; })} />;
  const title = !canEdit ? "View Reviewed UPS Bid" : bid?.status === "re-analyze" ? "Re-Analyze UPS Bid" : "Review & Accept UPS Bid";
  const status = bid?.status === "approved" ? "Approved" : bid?.status === "bid_rejected" ? "Rejected" : bid?.status === "re-analyze" ? "Re-Analyze Required" : bid?.status === "analyzed" ? "Reviewed" : "Pending";
  const content = <section className={embedded ? "container mx-auto mt-4 max-w-6xl bg-white px-4 pb-10" : "max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"}>
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 pt-2">
      <div className="flex flex-wrap items-center gap-4"><button type="button" disabled={saving} onClick={onClose} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-slate-800 hover:bg-slate-800 hover:text-white">← Back</button><h1 className="text-xl font-bold text-gray-800">{bid ? title : "UPS Bid Review"}</h1></div>
      {bid && <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status === "Pending" ? "border-amber-300 bg-amber-100 text-amber-700" : status === "Re-Analyze Required" || status === "Rejected" ? "border-rose-300 bg-rose-100 text-rose-700" : "border-green-300 bg-green-100 text-green-700"}`}>{status}</span>}
    </header>
    {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
    {!bid || !schema ? <p className="py-8 text-sm text-slate-500">Loading UPS bid...</p> : <form onSubmit={event => { if (!allVerified) { event.preventDefault(); return; } submit(event); }} className="[&_label]:font-semibold [&_label]:text-slate-800 [&_input]:border-blue-300 [&_select]:border-blue-300 [&_textarea]:border-blue-300">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
        {[["bid_no", "Bid Number", 150], ["dept_name", "Department", 255], ["organization", "Organization", 255], ["qty", "Quantity"], ["pincode", "Buyer Pincode", 6]].map(([name, label, maxLength]) => <div key={name}>
          {verificationLabel(`meta.${name}`, form[name], `ups-review-${name}`, label)}
          <input id={`ups-review-${name}`} value={form[name] ?? ""} maxLength={maxLength} type={name === "qty" ? "number" : "text"}
            min={name === "qty" ? 1 : undefined} inputMode={name === "pincode" ? "numeric" : undefined}
            required readOnly={!canEdit || saving} onChange={event => updateField(name, event.target.value)} className={inputClass} />
        </div>)}
        <div className="md:col-span-2 lg:col-span-3">{verificationLabel("meta.address", form.address, "ups-review-address", "Address")}<input id="ups-review-address" value={form.address ?? ""} required maxLength={5000} readOnly={!canEdit || saving} onChange={event => updateField("address", event.target.value)} className={inputClass} /></div>
        <div className="md:col-span-2 lg:col-span-3">{verificationLabel("meta.atc", form.atc, "ups-review-atc", "ATC (Additional Terms & Conditions)")}<textarea id="ups-review-atc" rows={4} value={form.atc ?? ""} maxLength={10000} readOnly={!canEdit || saving} onChange={event => updateField("atc", event.target.value)} className={`${inputClass} resize-none`} /></div>
        <UpsAnalyserComplianceDocuments bid={bid} schema={schema} />
      </div>
      <div className="mt-5"><UpsConfig schema={schema} type={bid.ups_type} specs={form.specs} disabled={!canEdit || saving} onChange={specs => setForm({ ...form, specs })} modelNumber={form.model_number} onModelChange={model_number => setForm(previous => ({ ...previous, model_number }))}
        renderModelLabel={verificationLabel("meta.model_number", form.model_number, "ups-model-number", "Model Number")}
        renderLabel={field => verificationLabel(`spec.${field.key}`, specs[field.key], `ups-${field.key}`, field.label, !field.required)}>
        {[["start_date", "Bid Start Date"], ["end_date", "Bid End Date"]].map(([name, label]) => <div key={name}>{verificationLabel(`meta.${name}`, form[name], `ups-review-${name}`, label)}<input id={`ups-review-${name}`} type="date" value={form[name] || ""} readOnly={!canEdit || saving} onChange={event => updateField(name, event.target.value)} className={inputClass} /></div>)}
        {bid.status === "approved" && <div className="relative min-w-0">
          <div className="mb-1 h-5" aria-hidden="true" />
          <div className="relative flex items-center">
            <label htmlFor="ups-approved-price" className="pointer-events-none absolute left-3 z-10 text-sm font-bold text-gray-700">Total Approved Price</label>
            <input id="ups-approved-price" type="text" value={Number(bid.approved_price) > 0 ? `₹ ${Number(bid.approved_price).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : ""} readOnly disabled placeholder="0" className="h-[58px] min-w-0 flex-1 rounded-md border border-gray-300 bg-gray-100 py-2 pl-44 pr-3 text-right text-base font-semibold text-slate-800" />
          </div>
        </div>}
      </UpsConfig></div>
      <div className="mt-6" />
      {bid.admin_note && <p className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><b>Admin Note:</b> {bid.admin_note}</p>}
      {canEdit ? <>
        <div className="mt-6 text-sm font-medium text-slate-600" aria-live="polite">Verified {verifiedCount} / {requiredChecks.length} required fields</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-md border border-gray-300 bg-white px-8 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50">Back</button><button disabled={saving || !allVerified} className="rounded-md bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Next"}</button></div>
      </> : <><p className="text-sm text-slate-500">{bid.analyser_note && <><b>Analyser Note:</b> {bid.analyser_note}<br /></>}This bid is not pending your review.</p><button type="button" onClick={onClose} className="mt-6 rounded-md border border-gray-300 bg-white px-8 py-2.5 text-sm font-semibold text-gray-700 shadow-sm">Back</button></>}
    </form>}
  </section>;
  return embedded ? content : <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6">{content}</div>;
}
