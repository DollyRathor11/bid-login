import { useState } from "react";
import { useParams } from "react-router-dom";
import { catalogs } from "./ComponentRates";
import { API_BASE } from "../../utils/componentRates";

const products = { desktop: "Desktop", aio: "AIO", workstation: "Workstation" };
const inputClass = "min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500";

export default function AddComponent() {
  const { product: routeProduct } = useParams();
  const product = catalogs[routeProduct] ? routeProduct : "desktop";
  return <ProductComponents key={product} product={product} />;
}

function ProductComponents({ product }) {
  const [selectedSpecs, setSelectedSpecs] = useState({});
  const [editingGroup, setEditingGroup] = useState("");
  const [names, setNames] = useState({});
  const [prices, setPrices] = useState({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(() => {
    const saved = sessionStorage.getItem("component-added");
    sessionStorage.removeItem("component-added");
    try {
      const added = JSON.parse(saved);
      return added?.product === product ? added.message : "";
    } catch { return ""; }
  });
  const [success, setSuccess] = useState(Boolean(message));
  const groups = catalogs[product];

  const addComponent = async (event, category, group) => {
    event.preventDefault();
    const cleanName = (names[group] || "").trim().replace(/\s+/g, " ");
    setSuccess(false);
    if (!cleanName || ["none", "select"].includes(cleanName.toLowerCase())) {
      setMessage("Please enter a valid component name.");
      return;
    }
    if (groups.some(([key, , items]) => key === category
      && items.some((item) => item.name.toLowerCase() === cleanName.toLowerCase()))) {
      setMessage("This component already exists. Set its price in Component Rate.");
      return;
    }
    setBusy(group);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/component-options/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, group, name: cleanName, price: prices[group] ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Component could not be added.");
      sessionStorage.setItem("component-added", JSON.stringify({ product, message: `${products[product]}: ${cleanName} and its price added successfully.` }));
      window.location.reload();
    } catch (error) {
      setMessage(error.message);
      setBusy("");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-blue-600">Add Component</p>
          <h2 className="text-2xl font-black text-slate-800">{products[product]} Specifications</h2>
          <p className="mt-2 text-sm text-slate-500">Choose a specification and select Add New to add a component with its price.</p>
        </div>
      </div>
      {message && <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid items-start gap-x-6 gap-y-5 lg:grid-cols-2">
          {groups.map(([category, group, items], index) => {
            return (
              <form key={group} onSubmit={(event) => addComponent(event, category, group)} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                <label htmlFor={`component-${product}-${index}`} className="mb-2 block text-sm font-bold text-slate-800">{group}</label>
                <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-2">
                  <select id={`component-${product}-${index}`} value={selectedSpecs[group] || ""} onChange={(event) => setSelectedSpecs((old) => ({ ...old, [group]: event.target.value }))} className={inputClass}>
                    <option value="">Select</option>
                    {items.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                  <button type="button" disabled={Boolean(busy)} aria-expanded={editingGroup === group} aria-controls={`new-component-${product}-${index}`} onClick={() => setEditingGroup(editingGroup === group ? "" : group)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50">{editingGroup === group ? "Close" : "+ Add New"}</button>
                </div>
                {editingGroup === group && (
                  <div id={`new-component-${product}-${index}`} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                      <label className="block text-xs font-semibold text-slate-600">
                        Component name
                        <input autoFocus required maxLength={500} disabled={Boolean(busy)} value={names[group] || ""} onChange={(event) => setNames((old) => ({ ...old, [group]: event.target.value }))} placeholder={`Enter ${group.toLowerCase()} specification`} className={`${inputClass} mt-1.5 font-normal`} />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Price (₹)
                        <input type="number" required min="0" max="999999999999.99" step="0.01" disabled={Boolean(busy)} value={prices[group] ?? ""} onChange={(event) => setPrices((old) => ({ ...old, [group]: event.target.value }))} placeholder="0.00" className={`${inputClass} mt-1.5 font-normal [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
                      </label>
                    </div>
                    {category === "processor" && <p className="text-xs leading-relaxed text-slate-500">Include the processor family: Intel, AMD, Ultra, Xeon or Threadripper.</p>}
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" disabled={Boolean(busy)} onClick={() => setEditingGroup("")} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">Cancel</button>
                      <button disabled={Boolean(busy)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{busy === group ? "Saving..." : "Save Component"}</button>
                    </div>
                  </div>
                )}
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
