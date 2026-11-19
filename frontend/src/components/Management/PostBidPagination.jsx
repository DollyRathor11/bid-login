const buttonClass = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

// Prev / page numbers / Next under a Post Bid list; hidden when one page is enough.
export default function PostBidPagination({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null;
  const first = Math.min(Math.max(1, page - 2), Math.max(1, pageCount - 4));
  const numbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => first + index);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 px-5 py-4">
      <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)} className={buttonClass}>Prev</button>
      {numbers.map((number) => (
        <button
          type="button"
          key={number}
          aria-label={`Page ${number}`}
          aria-current={number === page ? "page" : undefined}
          onClick={() => onPage(number)}
          className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-semibold ${number === page ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          {number}
        </button>
      ))}
      <button type="button" disabled={page === pageCount} onClick={() => onPage(page + 1)} className={buttonClass}>Next</button>
    </nav>
  );
}
