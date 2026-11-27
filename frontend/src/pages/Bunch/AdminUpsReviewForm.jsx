import { useRef, useState } from "react";
import RejectBidDialog from "../../components/Admin/RejectBidDialog";
import UpsAdminDocuments from "./UpsAdminDocuments";
import UpsConfig from "../Ups/UpsConfig";
import { epbgPriceError } from "../../utils/approvalComponentPrices";

const inputClass = "w-full min-w-0 rounded-md border border-slate-500 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-500 disabled:text-slate-500";
const price = value => { const number = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(number) ? number : 0; };
const noEpbgPrice = value => { const text = String(value ?? "").trim().replace(/%$/, "").trim(); return /^(na|n\/a|n\.a\.?|not applicable)$/i.test(text) || (text !== "" && Number(text) === 0); };

export default function AdminUpsReviewForm({ bid, schema, form, setForm, canEdit, saving, error, onAction, onClose, embedded }) {
  const formRef = useRef(null);
  const [validation, setValidation] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const approvedPrice = form.approved_price ?? "";
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  async function act(action, note) {
    setValidation("");
    if (action !== "bid_rejected") {
      if (!formRef.current?.reportValidity()) return;
      const epbgError = epbgPriceError(form);
      if (epbgError) { setValidation(epbgError.message); document.getElementById(`ups-admin-${epbgError.field}`)?.focus(); return; }
      if (action === "approved") {
        if (String(approvedPrice).trim() === "" || price(approvedPrice) <= 0) { setValidation("Please enter a Bid Approved Price greater than 0."); document.getElementById("ups-admin-approved_price")?.focus(); return; }
      }
    }
    const result = await onAction(action, note);
    if (result) setRejectOpen(false);
  }
  const content = <section className={embedded ? "mx-auto w-full max-w-7xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" : "flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"}>
    <header className="ups-admin-review-header flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-6 py-4">
      <div className="flex items-center gap-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm">← Back</button><div><h1 className="text-lg font-bold text-gray-800">Review &amp; Update UPS</h1><p className="mt-0.5 text-sm text-gray-500">Bid No: <span className="font-semibold text-blue-600">{bid?.bid_no || "—"}</span></p></div></div>
      <button type="button" disabled={saving} onClick={onClose} aria-label="Close UPS review" className="text-2xl leading-none text-gray-400 hover:text-gray-700">×</button>
    </header>
    <div className="overflow-y-auto p-6">
      {(error || validation) && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{validation || error}</p>}
      {!bid || !schema ? <p className="py-8 text-sm text-slate-500">Loading UPS bid...</p> : <form ref={formRef} onSubmit={event => { event.preventDefault(); act("approved"); }}>
        <p className="mb-5 text-xs text-slate-500">Submitted By: <b>{bid.user}</b> · Analyser: <b>{bid.analyser_username || "—"}</b> · {schema.types[bid.ups_type].label}</p>
        <fieldset disabled={!canEdit || saving} className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
          {[["bid_no", "Bid Number"], ["model_number", "Model Number"], ["dept_name", "Department"], ["organization", "Organization"], ["qty", "Quantity"], ["pincode", "Buyer Pincode"], ["start_date", "Bid Start Date"], ["end_date", "Bid End Date"], ["address", "Address"]].map(([name, label]) => <label key={name} className="block text-sm font-semibold text-slate-800">{label}<input id={`ups-admin-${name}`} className={`${inputClass} mt-1`} value={form[name] ?? ""} onChange={event => change(name, event.target.value)} type={name.includes("date") ? "date" : name === "qty" ? "number" : "text"} min={name === "qty" ? 1 : undefined} maxLength={name === "pincode" ? 6 : name === "model_number" || name === "bid_no" ? 150 : undefined} pattern={name === "pincode" ? "[1-9][0-9]{5}" : undefined} required={["bid_no", "dept_name", "organization", "qty", "pincode", "address"].includes(name)} /></label>)}
          <label className="block text-sm font-semibold text-slate-800 md:col-span-2 lg:col-span-3">ATC<textarea rows={4} className={`${inputClass} mt-1 resize-none`} value={form.atc || ""} onChange={event => change("atc", event.target.value)} /></label>
        </fieldset>
        <UpsAdminDocuments bid={bid} schema={schema} />
        <div className="[&_label]:font-semibold [&_label]:text-slate-800 [&_select]:border-slate-500 [&_select]:bg-slate-50 [&_input]:border-slate-500 [&_input]:bg-slate-50"><UpsConfig schema={schema} type={bid.ups_type} specs={form.specs} disabled={!canEdit || saving} onChange={specs => setForm(previous => ({ ...previous, specs }))} /></div>
        <fieldset disabled={!canEdit || saving} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div><label htmlFor="ups-admin-epbg" className="mb-1 block text-sm font-semibold text-slate-800">EPBG (%) <span className="text-red-600">*</span></label><div className="flex gap-2"><input id="ups-admin-epbg" required placeholder="0, percentage or NA" value={form.epbg ?? ""} onChange={event => change("epbg", event.target.value)} className={inputClass} /><input id="ups-admin-epbg_price" aria-label="EPBG price" type="number" min="0" step="0.01" disabled={noEpbgPrice(form.epbg) || !canEdit || saving} placeholder="Price" value={noEpbgPrice(form.epbg) ? "0" : form.epbg_price ?? ""} onChange={event => change("epbg_price", event.target.value)} className={`${inputClass} !w-24 shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} /></div></div>
          <div><label htmlFor="ups-admin-freight" className="mb-1 block text-sm font-semibold text-slate-800">Freight &amp; Installation</label><div className="flex gap-2"><select id="ups-admin-freight" value={form.freight_installation || "Yes"} onChange={event => change("freight_installation", event.target.value)} className={inputClass}><option value="Yes">Yes</option><option value="None">None</option></select><input aria-label="Freight and installation price" type="number" min="0" step="0.01" disabled={form.freight_installation !== "Yes" || !canEdit || saving} value={form.freight_installation === "Yes" ? form.freight_price ?? "" : "0"} onChange={event => change("freight_price", event.target.value)} className={`${inputClass} !w-24 shrink-0`} /></div></div>
          <label className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Bid Approved Price <span className="text-red-600">*</span><input id="ups-admin-approved_price" type="number" min="0.01" step="0.01" placeholder="Rs." value={approvedPrice} onChange={event => change("approved_price", event.target.value)} className={`${inputClass} mt-2 text-right text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} /></label>
          <label className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 md:col-span-3">Admin Review Note<textarea rows={3} maxLength={10000} placeholder="Write a clear note for re-analysis..." value={form.note || ""} onChange={event => change("note", event.target.value)} className={`${inputClass} mt-2 resize-none`} /></label>
        </fieldset>
        {!canEdit && <p className="mt-5 text-sm text-slate-500">{bid.admin_note || "This bid is not pending admin review."}</p>}
        {canEdit && <div className="mt-8 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => act("approved")} className="rounded-md bg-emerald-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Processing..." : bid.status === "approved" ? "Save Approved Changes" : "Approve Bid"}</button>
          {bid.status === "analyzed" && <><button type="button" disabled={saving} onClick={() => act("re-analyze")} className="rounded-md bg-rose-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Send to Re-Analyze</button><button type="button" disabled={saving} onClick={() => setRejectOpen(true)} className="rounded-md bg-red-900 px-8 py-2.5 text-sm font-semibold text-white hover:bg-red-950 disabled:opacity-50">Reject Bid</button></>}
        </div>}
      </form>}
    </div>
    <RejectBidDialog open={rejectOpen} submitting={saving} onCancel={() => setRejectOpen(false)} onConfirm={reason => act("bid_rejected", reason)} />
  </section>;
  return embedded ? <main className="min-h-screen bg-gray-50 p-4 sm:p-6">{content}</main> : <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">{content}</div>;
}
