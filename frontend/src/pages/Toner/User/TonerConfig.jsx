import { useEffect, useMemo, useRef, useState } from "react";
import { priceInputValue } from "../../../utils/price";

const API_BASE = import.meta.env.VITE_API_URL;

// Straight off Toner_Main_Specifications.pdf — Model Number and Country of
// Origin deliberately left out per that sheet's own note.
export const BRANDS = ["HP", "Canon", "Brother", "Epson", "Samsung", "Xerox", "Ricoh", "Kyocera", "Acxxel"];
export const CARTRIDGE_TYPES = ["Toner Cartridge", "Laser Toner", "Colour Toner"];
export const PRODUCT_CLASSES = ["OEM", "Compatible"];
export const COLOURS = ["Black", "Cyan", "Magenta", "Yellow", "All Colour"];
export const TECHNOLOGIES = ["Laser"];
export const PAGE_YIELDS = ["1,000", "1,500", "2,000", "2,500", "3,000", "5,000", "10,000", "30,000", "30,000+ Pages"];
export const YIELD_STANDARDS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO/IEC 19752", "ISO/IEC 19798", "ISO/IEC 29102",
  "ISO/IEC 28360", "ISO/IEC 27001", "ISO/IEC 17025", "ISO/IEC 24711", "CE Marking",
  "RoHS (2011/65/EU)", "REACH", "WEEE Directive", "FCC", "BIS/ISI Mark", "CPSIA",
  "UL Certification", "TÜV Mark", "GS Mark", "CB Scheme Certificate", "Energy Star", "EPEAT",
  "FSC Certification", "ISTA Certification", "BIS CRS", "E-Waste EPR Registration", "Manufacturer Rated",
];
export const CHIPS = ["With Chip", "Without Chip"];
export const PRINT_COVERAGES = ["5%"];
export const WARRANTIES = ["6 Months", "1 Year", "2 Years", "3 Years", "5 Years"];
export const WARRANTY_TYPES = ["Manufacturer Warranty", "Seller Warranty", "Replacement", "On-site", "Carry-in"];
export const QTY_PER_PACKS = ["1", "2", "3", "5", "10"];
export const COMPLIANCES = ["RoHS", "CE", "BIS", "ISO", "Other"];
export const REPLACEMENT_POLICIES = ["7 Days", "15 Days", "30 Days", "Defective Replacement"];
export const YES_NO = ["Yes", "No"];

// Deterministic per-brand color so any brand added later to the Excel sheet
// (toner_catalog.py) still gets a distinct, consistent badge color — no
// hardcoded brand list to maintain here.
const BRAND_COLOR_PALETTE = [
  { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  { bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500" },
  { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
  { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  { bg: "bg-teal-100", text: "text-teal-700", dot: "bg-teal-500" },
  { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", dot: "bg-fuchsia-500" },
  { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" },
];
const brandColor = (brand) => {
  let hash = 0;
  for (let i = 0; i < (brand || "").length; i++) hash = (hash * 31 + brand.charCodeAt(i)) >>> 0;
  return BRAND_COLOR_PALETTE[hash % BRAND_COLOR_PALETTE.length];
};

const INITIAL_FORM = {
  brand: "", cartridge_type: "", product_class: "", colour: "", compatibility: "", technology: "",
  page_yield: "", yield_standard: "", chip: "", print_coverage: "",
  warranty: "", warranty_type: "", refillable: "", qty_per_pack: "",
  hsn_code: "", compliance: "", replacement_policy: "",
  date: "", start_date: "", unit_price: "", toner_models: [],
};

const getDraftKey = (bidId) => `toner_config_draft_${bidId || "new"}`;
const tonerKey = (t) => `${t.brand}||${t.tonerModel}`;
// toner_models arrives as a JSON string from the backend (same convention as
// selected_general_docs/verified_fields) but as a real array from a restored
// localStorage draft — accept either.
const parseToners = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const normalizeInitialForm = (source = {}) => ({
  ...INITIAL_FORM,
  ...source,
  toner_models: parseToners(source.toner_models ?? INITIAL_FORM.toner_models),
});

export default function TonerConfig({ bidData, onBack, onNext }) {
  const bid_id = bidData?.bid_id;
  const draftKey = useMemo(() => getDraftKey(bid_id), [bid_id]);

  const [form, setForm] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey(bid_id));
      if (savedDraft) return normalizeInitialForm(JSON.parse(savedDraft));
    } catch (error) {
      console.warn("Unable to restore Toner configuration draft", error);
    }
    return normalizeInitialForm(bidData?.toner_config || bidData || {});
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [catalogueBrands, setCatalogueBrands] = useState(BRANDS);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/toner-catalog/toners/?brands=${encodeURIComponent(BRANDS.join(","))}`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load brands");
        return response.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.brands)) {
          setCatalogueBrands([...new Set([...BRANDS, ...data.brands])].filter((brand) => !["nargle", "nargel"].includes(brand.trim().toLowerCase())));
        }
      })
      .catch((error) => console.warn("Unable to load toner catalogue brands", error));
    return () => { cancelled = true; };
  }, []);
  const brandRef = useRef(null);
  const [tonerModelOpen, setTonerModelOpen] = useState(false);
  const [tonerModelSearch, setTonerModelSearch] = useState("");
  const [manualModelBrand, setManualModelBrand] = useState("");
  const [manualModelSaving, setManualModelSaving] = useState(false);
  const [manualModelError, setManualModelError] = useState("");
  const tonerModelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (brandRef.current && !brandRef.current.contains(e.target)) setBrandOpen(false);
      if (tonerModelRef.current && !tonerModelRef.current.contains(e.target)) setTonerModelOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setForm((prev) => {
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) return normalizeInitialForm(JSON.parse(savedDraft));
      } catch (error) {
        console.warn("Unable to restore Toner configuration draft", error);
      }
      return normalizeInitialForm({ ...bidData, ...prev });
    });
  }, [draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save Toner configuration draft", error);
    }
  }, [draftKey, form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const selectedBrands = form.brand ? form.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];

  const handleBrandToggle = (option) => {
    setForm((prev) => {
      const current = prev.brand ? prev.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];
      const next = current.includes(option)
        ? current.filter((b) => b !== option)
        : [...current, option];
      return { ...prev, brand: next.join(", ") };
    });
  };

  // Toner Model multi-select — driven by backend/data/HP_Toner_Printer_Compatibility.xlsx
  // via the /toner-catalog/ endpoints (toner_catalog.py).
  const [tonerModels, setTonerModels] = useState([]);
  const [tonerModelsLoading, setTonerModelsLoading] = useState(false);
  const [tonerModelsError, setTonerModelsError] = useState("");
  const [unionPrinters, setUnionPrinters] = useState([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [printersError, setPrintersError] = useState("");
  const autoCompatibilityRef = useRef("");

  // Drop any selected toner whose brand got unchecked in the Brand field
  // (and clear everything if Brand is cleared entirely).
  useEffect(() => {
    const allowedBrands = form.brand ? form.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];
    setForm((prev) => {
      const filtered = prev.toner_models.filter((t) => allowedBrands.includes(t.brand));
      if (filtered.length === prev.toner_models.length) return prev;
      return { ...prev, toner_models: filtered };
    });
  }, [form.brand]);

  useEffect(() => {
    const brands = form.brand ? form.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];
    if (brands.length === 0) {
      setTonerModels([]);
      setTonerModelsError("");
      return;
    }
    let cancelled = false;
    setTonerModelsLoading(true);
    setTonerModelsError("");
    fetch(`${API_BASE}/toner-catalog/toners/?brands=${encodeURIComponent(brands.join(","))}`)
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setTonerModels(data.toners || []);
      })
      .catch(() => {
        if (!cancelled) {
          setTonerModels([]);
          setTonerModelsError("Unable to load toner models. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setTonerModelsLoading(false);
      });
    return () => { cancelled = true; };
  }, [form.brand]);

  useEffect(() => {
    if (form.toner_models.length === 0) {      setUnionPrinters([]);
      setPrintersError("");
      setPrintersLoading(false);
      return;
    }
    let cancelled = false;
    setPrintersLoading(true);
    setPrintersError("");
    fetch(`${API_BASE}/toner-catalog/printers/bulk/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toners: form.toner_models }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setUnionPrinters(data.printers || []);
      })
      .catch(() => {
        if (!cancelled) {          setUnionPrinters([]);
          setPrintersError("Unable to load compatible printers. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setPrintersLoading(false);
      });
    return () => { cancelled = true; };
  }, [form.toner_models]);

  // Compatibility auto-fills from the union of selected toners' printers, but
  // never silently overwrites a manual edit — it only appends printers the
  // user's text doesn't already mention.
  useEffect(() => {
    const autoValue = unionPrinters.map((p) => p.printerModel).join(", ");
    setForm((prev) => {
      const isUntouched = prev.compatibility === "" || prev.compatibility === autoCompatibilityRef.current;
      if (isUntouched) {
        autoCompatibilityRef.current = autoValue;
        return prev.compatibility === autoValue ? prev : { ...prev, compatibility: autoValue };
      }
      const existingLower = prev.compatibility.toLowerCase();
      const missing = unionPrinters.filter((p) => !existingLower.includes(p.printerModel.toLowerCase()));
      if (missing.length === 0) return prev;
      const base = prev.compatibility.trim().replace(/,\s*$/, "");
      const appended = `${base}${base ? ", " : ""}${missing.map((p) => p.printerModel).join(", ")}`;
      return { ...prev, compatibility: appended };
    });
  }, [unionPrinters]);

  // Colour of Ink: a single mono toner auto-picks its one colour; several
  // toners narrow the choices to colours common to all of them.
  useEffect(() => {
    if (form.toner_models.length !== 1) return;
    const entry = tonerModels.find((t) => t.brand === form.toner_models[0].brand && t.tonerModel === form.toner_models[0].tonerModel);
    if (!entry) return;
    const colours = [...new Set((entry.partNumbers || []).map((p) => p.color).filter(Boolean))];
    const derived = COLOURS.filter((c) => colours.includes(c));
    if (derived.length === 1) {
      setForm((prev) => (prev.colour === derived[0] ? prev : { ...prev, colour: derived[0] }));
    }
  }, [form.toner_models, tonerModels]);

  const handleToggleToner = (t) => {
    setForm((prev) => {
      const key = tonerKey(t);
      const exists = prev.toner_models.some((x) => tonerKey(x) === key);
      const next = exists
        ? prev.toner_models.filter((x) => tonerKey(x) !== key)
        : [...prev.toner_models, { brand: t.brand, tonerModel: t.tonerModel }];
      return { ...prev, toner_models: next };
    });
  };

  const selectedTonerKeys = form.toner_models.map(tonerKey);
  const getTonerEntry = (t) => tonerModels.find((tm) => tm.brand === t.brand && tm.tonerModel === t.tonerModel);

  const colourOptions = useMemo(() => {
    const selectedEntries = form.toner_models.map(getTonerEntry).filter(Boolean);
    const coloursOf = (entry) => [...new Set((entry.partNumbers || []).map((p) => p.color).filter(Boolean))];
    let options = COLOURS;
    if (selectedEntries.length === 1) {
      const derived = COLOURS.filter((c) => coloursOf(selectedEntries[0]).includes(c));
      if (derived.length) options = derived;
    } else if (selectedEntries.length > 1) {
      const perToner = selectedEntries.map(coloursOf);
      const common = COLOURS.filter((c) => perToner.every((set) => set.includes(c)));
      if (common.length) options = common;
    }
    if (form.colour && !options.includes(form.colour)) options = [...options, form.colour];
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.toner_models, form.colour, tonerModels]);

  const manualBrand = selectedBrands.includes(manualModelBrand) ? manualModelBrand : selectedBrands[0] || "";
  const addManualToner = async () => {
    const model = tonerModelSearch.trim();
    if (!model || !manualBrand || manualModelSaving) return;
    setManualModelSaving(true);
    setManualModelError("");
    try {
      const response = await fetch(`${API_BASE}/toner-catalog/toners/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: manualBrand, tonerModel: model }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.toner) throw new Error(data.error || "Unable to save toner model. Please try again.");
      setTonerModels((prev) => prev.some((toner) => tonerKey(toner) === tonerKey(data.toner)) ? prev : [...prev, data.toner]);
    const selection = { brand: data.toner.brand, tonerModel: data.toner.tonerModel };
    setForm((prev) => prev.toner_models.some((toner) => tonerKey(toner) === tonerKey(selection))
      ? prev : { ...prev, toner_models: [...prev.toner_models, selection] });
    setTonerModelSearch("");
    setTonerModelOpen(false);
    } catch (error) {
      setManualModelError(error.message || "Unable to save toner model.");
    } finally {
      setManualModelSaving(false);
    }
  };
  const availableTonerModels = [...tonerModels, ...form.toner_models.filter((toner) =>
    !tonerModels.some((entry) => tonerKey(entry) === tonerKey(toner))
  )];
  const tonerSearchLower = tonerModelSearch.trim().toLowerCase();
  const groupedTonerModels = selectedBrands.map((brand) => ({
    brand,
    items: availableTonerModels.filter(
      (t) => t.brand === brand &&
        (!tonerSearchLower ||
          t.tonerModel.toLowerCase().includes(tonerSearchLower) ||
          brand.toLowerCase().includes(tonerSearchLower))
    ),
  })).filter((g) => g.items.length > 0);

  // Compatibility is stored as one comma-separated string (same field the
  // backend/Excel-driven auto-fill already writes to) but shown as small
  // removable chips instead of a hard-to-read wrapped line of text.
  const [compatibilityInput, setCompatibilityInput] = useState("");
  const compatibilityItems = form.compatibility
    ? form.compatibility.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const addCompatibilityItem = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setForm((prev) => {
      const items = prev.compatibility ? prev.compatibility.split(",").map((s) => s.trim()).filter(Boolean) : [];
      if (items.includes(trimmed)) return prev;
      return { ...prev, compatibility: [...items, trimmed].join(", ") };
    });
    setCompatibilityInput("");
  };

  const removeCompatibilityItem = (item) => {
    setForm((prev) => {
      const items = prev.compatibility.split(",").map((s) => s.trim()).filter(Boolean).filter((x) => x !== item);
      return { ...prev, compatibility: items.join(", ") };
    });
  };

  const handleCompatibilityInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCompatibilityItem(compatibilityInput);
    } else if (e.key === "Backspace" && !compatibilityInput && compatibilityItems.length > 0) {
      removeCompatibilityItem(compatibilityItems[compatibilityItems.length - 1]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedBrands.length === 0) {
      setMsg("Please select at least one Brand");
      return;
    }
    if (compatibilityItems.length === 0) {
      setMsg("Please add at least one Compatibility entry");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...form, toner_models: JSON.stringify(form.toner_models) };
      const res = await fetch(`${API_BASE}/toner-bids/${bid_id}/update/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMsg("Data Saved Successfully");
        localStorage.removeItem(draftKey);
        onNext({ ...form });
      } else {
        const result = await res.json().catch(() => ({}));
        setMsg(result.error || "Failed to Save Data. Please try again.");
      }
    } catch (error) {
      console.error(error);
      setMsg("Connection Error — Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const SelectField = ({ label, name, options, required, optional }) => (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {optional && <span className="text-red-500 text-[11px] font-normal">*Optional</span>}
      </div>
      <select
        name={name}
        value={form[name]}
        onChange={handleChange}
        required={required}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
      >
        <option value="">Select</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-4 pt-2 border-b pb-2">
        <h5 className="text-lg font-semibold text-gray-800">Create Toner Configuration</h5>
      </div>

      {msg && (
        <div
          className={`mb-4 px-4 py-2 rounded text-sm font-medium ${
            msg.includes("Saved") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <div className="col-span-1 relative" ref={brandRef}>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Brand</label>
            </div>
            <button
              type="button"
              onClick={() => setBrandOpen((prev) => !prev)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 flex items-center justify-between"
            >
              <span className={selectedBrands.length ? "truncate" : "text-gray-400"}>
                {selectedBrands.length ? selectedBrands.join(", ") : "Select"}
              </span>
              <span className={`ml-2 shrink-0 transition-transform ${brandOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {brandOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto border border-gray-300 rounded-md bg-white shadow-lg py-1">
                {catalogueBrands.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(opt)}
                      onChange={() => handleBrandToggle(opt)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-1 relative" ref={tonerModelRef}>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Toner Model</label>
            </div>
            <button
              type="button"
              onClick={() => selectedBrands.length > 0 && !tonerModelsLoading && setTonerModelOpen((prev) => !prev)}
              disabled={selectedBrands.length === 0 || tonerModelsLoading}
              aria-expanded={tonerModelOpen}
              aria-controls="toner-model-picker"
              className="w-full min-h-[38px] border border-gray-300 rounded-md px-3 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400 flex items-center justify-between gap-2"
            >
              {form.toner_models.length > 0 ? (
                <span className="truncate text-gray-700">{form.toner_models[0].tonerModel}</span>
              ) : (
                <span className="text-gray-400">
                  {selectedBrands.length === 0 ? "Select Brand first" : tonerModelsLoading ? "Loading..." : "Select toner model(s)"}
                </span>
              )}
              <span className={`ml-2 shrink-0 transition-transform ${tonerModelOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {tonerModelOpen && selectedBrands.length > 0 && (
              <div id="toner-model-picker" className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-700">Choose toner models</span>
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{form.toner_models.length} selected</span>
                </div>
                <div className="p-3 flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-slate-400" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
                  <input
                    type="text"
                    autoFocus
                    value={tonerModelSearch}
                    onChange={(e) => setTonerModelSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addManualToner();
                      }
                    }}
                    placeholder="Search toner model..."
                    aria-label="Search toner models or enter a new model"
                    className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  </div>
                  {form.toner_models.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, toner_models: [] }))}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto px-2 pb-2">
                  {groupedTonerModels.length === 0 && (
                    <div className="rounded-lg bg-slate-50 px-3 py-5 text-xs text-slate-500 text-center">
                      {tonerModelsError || "No toner models found."}
                    </div>
                  )}
                  {groupedTonerModels.map((group) => (
                    <div key={group.brand}>
                      {selectedBrands.length > 1 && (
                        <div className={`sticky top-0 px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${brandColor(group.brand).bg} ${brandColor(group.brand).text}`}>
                          {group.brand}
                        </div>
                      )}
                      {group.items.map((t) => {
                        const isSelected = selectedTonerKeys.includes(tonerKey(t));
                        return (
                          <label
                            key={tonerKey(t)}
                            className={`my-1 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${isSelected ? "border-blue-200 bg-blue-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleToner(t)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate font-medium ${isSelected ? "text-blue-800" : "text-slate-800"}`}>{t.tonerModel}</span>
                              {t.cartridgeType && <span className="block text-[11px] text-slate-400">{t.cartridgeType}</span>}
                            </span>
                            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${brandColor(t.brand).bg} ${brandColor(t.brand).text}`}>{t.brand}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 bg-slate-50/80 p-4 space-y-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Add a new model</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">Can't find your model? Enter its number in the search above.</p>
                  </div>
                  {selectedBrands.length > 1 && (
                    <select aria-label="Brand for manual toner model" value={manualBrand}
                      onChange={(e) => setManualModelBrand(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                      {selectedBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={addManualToner} disabled={!tonerModelSearch.trim() || manualModelSaving}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none break-words">
                    {manualModelSaving ? "Saving model..." : tonerModelSearch.trim() ? `Add ${tonerModelSearch.trim()} for ${manualBrand}` : "Add model manually"}
                  </button>
                  {manualModelError && <p role="alert" className="text-xs text-red-600">{manualModelError}</p>}
                  <p className="text-[11px] leading-4 text-slate-500">Saved models stay available for this brand. Add printers under Compatible Printer Models.</p>
                </div>
              </div>
            )}
            {tonerModelsError && <p className="text-xs text-red-600 mt-1">{tonerModelsError}</p>}
            {!tonerModelsError && !tonerModelsLoading && selectedBrands.length > 0 && tonerModels.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No toner models available for the selected brand(s).</p>
            )}
          </div>
          {/* First selected toner shows in the Toner Model field above; each
              further one gets its own field, appearing only once picked. */}
          {form.toner_models.slice(1).map((t, index) => (
            <div key={tonerKey(t)} className="col-span-1">
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Toner Model {index + 2}</label>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={t.tonerModel}
                  readOnly
                  className="w-full border border-gray-300 rounded-md pl-3 pr-8 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleToggleToner(t)}
                  aria-label={`Remove ${t.tonerModel}`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <SelectField label="Type of Cartridge" name="cartridge_type" options={CARTRIDGE_TYPES} required />
          <SelectField label="Colour of Ink" name="colour" options={colourOptions} required />

          <div className="col-span-1 md:col-span-3 min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6zM18 12h.01" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Compatible Printer Models</div>
                  <p className="mt-0.5 text-xs text-slate-500">Printer models supported by your selected toner</p>
                </div>
              </div>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700" aria-live="polite">
                {compatibilityItems.length} {compatibilityItems.length === 1 ? "model" : "models"}
              </span>
            </div>
            <div className="p-4 sm:p-5">
            {printersLoading && <div className="text-xs text-gray-400 mb-2">Loading compatible printers...</div>}
            {printersError && <div className="text-xs text-red-600 mb-2">{printersError}</div>}
            <div className="flex flex-wrap gap-2">
              {compatibilityItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="break-words">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeCompatibilityItem(item)}
                    aria-label={`Remove ${item}`}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
                  </button>
                </span>
              ))}
            </div>
            {compatibilityItems.length === 0 && !printersLoading && <p className="text-xs text-slate-400">No printer models added.</p>}
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-50 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-slate-400" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              <input
                id="toner-compatibility-input"
                type="text"
                value={compatibilityInput}
                onChange={(e) => setCompatibilityInput(e.target.value)}
                onKeyDown={handleCompatibilityInputKeyDown}
                onBlur={() => addCompatibilityItem(compatibilityInput)}
                aria-label="Add compatible printer model"
                placeholder="Add a printer model or series..."
                className="w-full min-w-0 border-none bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
              />
            <button type="button" onClick={() => addCompatibilityItem(compatibilityInput)} disabled={!compatibilityInput.trim()}
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              Add
            </button>
            </div>
          </div>
          </div>

          <SelectField label="Technology" name="technology" options={TECHNOLOGIES} required />
          <SelectField label="Page Yield" name="page_yield" options={PAGE_YIELDS} required />
          <SelectField label="Chip" name="chip" options={CHIPS} required />
          <SelectField label="Print Coverage" name="print_coverage" options={PRINT_COVERAGES} optional />
          <SelectField label="Warranty" name="warranty" options={WARRANTIES} required />
          <SelectField label="Warranty Type" name="warranty_type" options={WARRANTY_TYPES} required />
          <SelectField label="Refillable" name="refillable" options={YES_NO} required />
          <SelectField label="Quantity per Pack" name="qty_per_pack" options={QTY_PER_PACKS} required />
          <SelectField label="Compliance" name="compliance" options={COMPLIANCES} optional />
          <SelectField label="Replacement Policy" name="replacement_policy" options={REPLACEMENT_POLICIES} required />

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">HSN Code</label>
            </div>
            <input
              type="text"
              name="hsn_code"
              value={form.hsn_code}
              onChange={handleChange}
              required
              placeholder="Applicable HSN Code"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
            <input
              type="text"
              name="unit_price"
              value={priceInputValue(form.unit_price)}
              onChange={handleChange}
              placeholder="Price"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bid Start Date</label>
            <input
              type="date"
              name="start_date"
              value={form.start_date}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bid End Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-start items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-8 mb-10 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold px-6 py-2.5 rounded-md text-sm transition"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="mt-8 mb-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition shadow-lg active:scale-95 whitespace-nowrap flex items-center gap-2"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                View Bid Products at a Glance
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
