// A schedule-wise bunch bid (GeM "Item wise evaluation"): only our own items
// need to be quoted, the bunch's other items are not mandatory.
export default function ScheduleBidTag({ row }) {
  if (!row?.schedule_wise) return null;
  return (
    <span
      className="ml-2 inline-block whitespace-nowrap rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
      title="Item wise evaluation: quote only our own items, the other items are not mandatory"
    >
      Schedule Bid
    </span>
  );
}
