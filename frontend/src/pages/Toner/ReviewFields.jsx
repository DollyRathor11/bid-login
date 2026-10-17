import { useEffect, useState } from "react";
import { BRANDS } from "./User/TonerConfig";

export function TonerModels({ value }) {
  let models = value;
  if (!Array.isArray(models)) {
    try { models = JSON.parse(value || "[]"); } catch { models = []; }
  }
  if (!Array.isArray(models)) models = [];
  return <div className="min-h-[38px] flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    {models.length ? models.map((model) => <span key={`${model.brand}-${model.tonerModel}`} className="max-w-full break-words rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">{model.brand} {model.tonerModel}</span>) : <span className="text-sm text-slate-400">Not selected</span>}
  </div>;
}

export function TonerBrands({ value, onChange, disabled }) {
  const [brands, setBrands] = useState(BRANDS);
  const selected = (value || "").split(",").map((brand) => brand.trim()).filter(Boolean);
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.VITE_API_URL}/toner-catalog/toners/?brands=HP`)
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (!cancelled && Array.isArray(data.brands)) setBrands([...new Set([...BRANDS, ...data.brands])].filter((brand) => !["nargle", "nargel"].includes(brand.trim().toLowerCase()))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
    <div className="flex flex-wrap gap-1.5">{selected.length ? selected.map((brand) => <span key={brand} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">{brand}{!disabled && <button type="button" aria-label={`Remove ${brand}`} onClick={() => onChange(selected.filter((item) => item !== brand).join(", "))} className="ml-2 text-slate-400 hover:text-red-600">×</button>}</span>) : <span className="text-xs text-slate-400">No brand selected</span>}</div>
    {!disabled && <select aria-label="Add toner brand" value="" onChange={(event) => { if (event.target.value) onChange([...selected, event.target.value].join(", ")); }} className="mt-2 w-full bg-transparent text-xs text-slate-600 outline-none"><option value="">Add brand...</option>{brands.filter((brand) => !selected.includes(brand)).map((brand) => <option key={brand}>{brand}</option>)}</select>}
  </div>;
}

export function CompatiblePrinterModels({ value, onChange, disabled }) {
  const [input, setInput] = useState("");
  const items = (value || "").split(",").map((item) => item.trim()).filter(Boolean);
  const add = () => {
    const additions = input.split(",").map((item) => item.trim()).filter(Boolean);
    if (additions.length) onChange([...new Set([...items, ...additions])].join(", "));
    setInput("");
  };
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3"><span className="text-xs text-slate-500">Printer models supported by the selected toner</span><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{items.length} {items.length === 1 ? "model" : "models"}</span></div>
    <div className="p-4"><div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"><span className="break-words">{item}</span>{!disabled && <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((model) => model !== item).join(", "))} className="text-slate-400 hover:text-red-600">×</button>}</span>)}{!items.length && <span className="text-xs text-slate-400">No printer models added.</span>}</div>
      {!disabled && <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 focus-within:border-blue-300"><span className="text-slate-400" aria-hidden="true">+</span><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} aria-label="Add compatible printer model" placeholder="Add a printer model or series..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="button" onClick={add} disabled={!input.trim()} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-100 disabled:text-slate-400">Add</button></div>}
    </div>
  </div>;
}
