import { useEffect } from "react";
import { fetchComponentRates } from "../utils/componentRates";
import { fillMissingApprovalPrices } from "../utils/approvalComponentPrices";

export default function useApprovalComponentPrices(product, bidId, pairs, setForm, calculateTotal, applyMargin) {
  useEffect(() => {
    if (!bidId) return;
    let active = true;
    let requestId = 0;
    const load = async () => {
      const currentRequest = ++requestId;
      try {
        const rates = await fetchComponentRates(product);
        if (!active || requestId !== currentRequest) return;
        setForm(previous => {
          if (String(previous.id || previous.bid_id) !== String(bidId)) return previous;
          const next = fillMissingApprovalPrices(previous, pairs, rates);
          return next === previous ? previous : applyMargin({ ...next, component_total_price: calculateTotal(next) });
        });
      } catch (error) { console.error("Approval component rates:", error); }
    };
    load();
    window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [product, bidId, pairs, setForm, calculateTotal, applyMargin]);
}
