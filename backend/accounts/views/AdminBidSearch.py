from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..dashboard_metrics import PRODUCTS, dashboard_status
from ..models import GemBidOpportunity
from .Gem import _require_role
from .ProductDashboard import _model


def bid_stage(bid):
    status = dashboard_status(bid)
    if bid.status == "draft":
        return "Draft", "User"
    if status == "approved":
        return "Approved", "Approved"
    if status == "rejected":
        return "Rejected", "Rejected"
    if status == "reAnalyze":
        return "Re-Analyze", "Analyser"
    if getattr(bid, "review_status", "") == "reviewed" or bid.status == "analyzed":
        return "Pending approval", "Admin"
    return "Pending analysis", "Analyser"


@require_GET
def admin_bid_search(request):
    _, error = _require_role(request, {"admin"})
    if error:
        return error
    query = request.GET.get("q", "").strip()
    if len(query) < 3 or len(query) > 100:
        return JsonResponse({"error": "Enter at least 3 and at most 100 characters of the bid number."}, status=400)

    # Search every product, independent of dashboard filters. Include hidden and
    # completed assignments so historical bids can still be located.
    rows, found_numbers = [], set()
    opportunities = list(GemBidOpportunity.objects.filter(bid_no__icontains=query).select_related("assignment__assigned_to")[:51])
    by_number = {o.bid_no.casefold(): o for o in opportunities}
    truncated = len(opportunities) > 50
    for product in PRODUCTS:
        bids = list(_model(product).objects.filter(bid_no__icontains=query).select_related("user").order_by("-updated_at", "-pk")[:51])
        truncated = truncated or len(bids) > 50
        for bid in bids[:50]:
            number = bid.bid_no.casefold()
            found_numbers.add(number)
            opportunity = by_number.get(number)
            assignment = getattr(opportunity, "assignment", None) if opportunity else None
            status, stage = bid_stage(bid)
            rows.append({
                "key": f"{product}-{bid.pk}", "bid_no": bid.bid_no,
                "product": product, "status": status, "stage": stage,
                "user": bid.user.username if bid.user else getattr(bid, "username", "") or "",
                "assigned_user": assignment.assigned_to.username if assignment else "",
                "analyser": bid.analyser_username or "",
                "participation": assignment.get_status_display() if assignment else "Not recorded",
            })
    for opportunity in opportunities[:50]:
        if opportunity.bid_no.casefold() in found_numbers:
            continue
        assignment = getattr(opportunity, "assignment", None)
        rows.append({
            "key": f"assignment-{opportunity.pk}", "bid_no": opportunity.bid_no,
            "product": opportunity.product_type or opportunity.product_name,
            "user": "", "analyser": "",
            "assigned_user": assignment.assigned_to.username if assignment else "",
            "participation": assignment.get_status_display() if assignment else "Not assigned",
            "status": assignment.get_status_display() if assignment else "Not assigned",
            "stage": "User" if assignment and assignment.status in ("assigned", "in_progress") else "No submitted form found",
        })
    return JsonResponse({"results": rows, "truncated": truncated})
