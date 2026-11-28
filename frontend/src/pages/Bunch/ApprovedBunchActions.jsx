import { FaTrashAlt } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";

const buttonClass = "rounded bg-blue-600 px-3 py-2 text-xs font-semibold uppercase text-white shadow-sm disabled:opacity-50";
export default function ApprovedBunchActions({ group, deletion }) {
  const location = useLocation();
  const upsItems = group.items.filter(item => item.product === "ups" && item.status === "approved");

  return <>
    <td className="border-b border-slate-100 px-2 py-4">
      <Link to={`/analyser-dashboard/bunch/approved-details?${new URLSearchParams({ bid_no: group.bid_no })}`}
        state={{ returnTo: location.pathname + location.search }} className={`inline-block ${buttonClass}`}>Download</Link>
    </td>
    <td className="border-b border-slate-100 px-2 py-4">
      <Link to={`/analyser-dashboard/bunch/downloads?${new URLSearchParams({ bid_no: group.bid_no })}`}
        state={{ returnTo: location.pathname + location.search }} className={`inline-block ${buttonClass}`}>Download</Link>
    </td>
    <td className="border-b border-slate-100 px-2 py-4">
      {upsItems.map(item => {
        const label = `UPS ${item.model_number || `#${item.id}`} from bid ${group.bid_no}`;
        const disabled = !item.can_delete || deletion.deleting;
        return <div key={item.id} className="flex items-center justify-center gap-2">
          <input type="checkbox" aria-label={`Select ${label}`} className="h-4 w-4 accent-red-600"
            checked={deletion.selectedIds.has(item.id)} disabled={disabled}
            onChange={event => deletion.select([item.id], event.target.checked)} />
          <button type="button" aria-label={`Delete ${label}`} title={item.can_delete ? "Permanently delete UPS bid" : "Only the assigned analyser can delete this UPS bid"}
            className="flex h-8 w-8 items-center justify-center rounded bg-red-50 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
            disabled={disabled} onClick={() => deletion.deleteBids([item.id], label)}><FaTrashAlt aria-hidden="true" /></button>
        </div>;
      })}
    </td>
  </>;
}
