export function bunchProductPath(product, id) {
  return product === "ups" ? `/analyser-dashboard/bunch/ups/${id}` : `/analyser-dashboard/${product}/bid/${id}`;
}

export function bunchAdminPath(product, id, status = "pending") {
  return product === "ups" ? `/admin-dashboard/bunch/ups/${id}`
    : `/admin-dashboard/${product}-bid-approval?${new URLSearchParams({ status, bid: String(id), from: "all-bids" })}`;
}

export function bunchReviewItems(items, context, search = "") {
  if (context?.role !== "admin") return items;
  const returnParams = new URLSearchParams(context.returnTo?.split("?")[1]);
  if (returnParams.get("dashboard") === "1") return items;
  const status = context.reviewStatus || returnParams.get("status") || new URLSearchParams(search).get("status") || "pending";
  return items.filter(item => item.status === status);
}

export function resolveBunchNavigation(pathname, context, to, options) {
  if (!context) return { to, options };
  if (context.role === "admin") {
    const returnTo = context.returnTo || "/admin-dashboard/bunch-bid-approval";
    if (typeof to === "number" || (typeof to === "string" && (to === "/admin-dashboard" || to.startsWith("/admin-dashboard/all-bids-approval")))) {
      return { to: returnTo, options: { replace: true } };
    }
    return { to, options };
  }
  const reviewPath = bunchProductPath(context.product, context.id);
  const returnTo = context.returnTo || "/analyser-dashboard/bunch";
  const state = { ...options?.state, bunchReview: options?.state?.bunchReview || context };
  if (typeof to === "number") {
    const documents = pathname === "/analyser-document" || /\/documents?\/?$/.test(pathname);
    return documents
      ? { to: reviewPath, options: { ...options, state } }
      : { to: returnTo, options: { replace: true } };
  }
  if (typeof to !== "string") return { to, options };
  // Existing document pages navigate to the product list after a successful
  // submit. Stay in the bunch workspace with the submitted form read-only.
  if (/^\/analyser-dashboard\/(desktop|aio|workstation|printer|toner)\/?$/.test(to)) {
    return { to: reviewPath, options: { ...options, replace: true, state: {
      ...state, readOnly: true, bunchReview: { ...context, submitted: true },
    } } };
  }
  const isReview = to === "/analyser-document" || /^\/analyser-dashboard\/(?:desktop|aio|workstation|printer|toner)\/(?:bid\/\d+(?:\/documents)?|document)\/?$/.test(to)
    || /^\/analyser-dashboard\/bunch\/ups\/\d+(?:\/documents)?\/?$/.test(to);
  return isReview ? { to, options: { ...options, state } } : { to, options };
}
