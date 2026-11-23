"""Read-only grouping; existing product review endpoints retain their rules."""
import math

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from ..dashboard_metrics import PRODUCTS, dashboard_status
from ..bunch_membership import eligible_groups, normalized_number
from ..models import UpsBid
from .Gem import _require_role
from .ProductDashboard import _model
from .Ups import serialize_ups


def bunch_status(rows):
    statuses = {r["status"] for r in rows}
    if statuses == {"approved"}:
        return "approved"
    if statuses == {"rejected"}:
        return "rejected"
    if "re-analyze" in statuses:
        return "re-analyze"
    return "pending"


def bunch_dashboard_status(group):
    return "reAnalyze" if group["status"] == "re-analyze" else group["status"]


def bunch_dashboard_summary(request, actor, year):
    stats = dict.fromkeys(("total", "pending", "approved", "reAnalyze", "rejected"), 0)
    months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    monthly = [{"month": month, "monthNumber": i, **stats} for i, month in enumerate(months, 1)]
    years = {timezone.localdate().year, year}
    users, analysers = set(), set()
    for group in bunch_groups(request, actor, dashboard=True):
        label = bunch_dashboard_status(group)
        stats["total"] += 1
        stats[label] += 1
        created = timezone.localtime(group["created_at"])
        years.add(created.year)
        if created.year == year:
            monthly[created.month - 1]["total"] += 1
            monthly[created.month - 1][label] += 1
        for item in group["items"]:
            if item["user"]:
                users.add(item["user"])
            if item["analyser_username"]:
                analysers.add(item["analyser_username"])
    return {
        "stats": stats, "monthly": monthly, "years": sorted(years, reverse=True),
        "participants": {"users": sorted(users), "analysers": sorted(analysers)},
    }


@require_GET
def admin_bunch_dashboard(request):
    actor, error = _require_role(request, {"admin"})
    if error:
        return error
    try:
        year = int(request.GET.get("year") or timezone.localdate().year)
        if not 1 <= year <= 9999:
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid year"}, status=400)
    return JsonResponse(bunch_dashboard_summary(request, actor, year))


def bunch_groups(request, actor, search="", exact="", dashboard=False):
    rows = []
    for product in PRODUCTS:
        queryset = _model(product).objects.exclude(status="draft").select_related("user")
        if search or exact:
            queryset = queryset.filter(bid_no__icontains=exact or search)
        for bid in queryset.iterator():
            if exact and normalized_number(bid.bid_no) != normalized_number(exact):
                continue
            label = dashboard_status(bid)
            review = getattr(bid, "review_status", "")
            can_review = (bid.status == "complete" and review in ("reviewed", "approved", "re-analyze", "bid_rejected")) if hasattr(bid, "review_status") else bid.status in ("analyzed", "approved", "rejected", "re-analyze", "bid_rejected")
            rows.append({
                "id": bid.pk, "product": product, "bid_no": bid.bid_no,
                "product_kind": "multifunction_printer" if product == "printer" and "multifunction" in str(getattr(bid, "printer_type", "")).lower() else product,
                "dept_name": bid.dept_name, "qty": bid.qty,
                "end_date": getattr(bid, "date", None) or getattr(bid, "end_date", None),
                "user": bid.user.username if bid.user else getattr(bid, "username", ""),
                "analyser_username": bid.analyser_username or "",
                "model_number": getattr(bid, "model_number", "") or getattr(bid, "model", "") or getattr(bid, "model_no", ""),
                "status": "re-analyze" if label == "reAnalyze" else label,
                "can_review": can_review, "updated_at": bid.updated_at, "created_at": bid.created_at,
                "upload_document": request.build_absolute_uri(bid.upload_document.url) if getattr(bid, "upload_document", None) else "",
            })
    queryset = UpsBid.objects.exclude(status="draft").select_related("user")
    if search or exact:
        queryset = queryset.filter(bid_no__icontains=exact or search)
    for bid in queryset.iterator():
        if exact and normalized_number(bid.bid_no) != normalized_number(exact):
            continue
        row = serialize_ups(bid, request)
        row["status"] = {"complete": "pending", "analyzed": "pending", "bid_rejected": "rejected"}.get(bid.status, bid.status)
        row["workflow_status"] = bid.status
        row["created_at"] = bid.created_at
        row["can_review"] = bid.status in ("analyzed", "approved", "re-analyze", "bid_rejected")
        rows.append(row)
    groups = eligible_groups(rows)
    if actor.role == "admin":
        # Establish bunch membership before hiding products still with the
        # analyser. A single submitted member must remain a bunch bid.
        groups = {key: submitted for key, entries in groups.items()
                  if (submitted := [row for row in entries if row["can_review"]])}
    elif actor.role == "analyser":
        # Admin-pending products have left the analyser's pending queue.
        # Keep membership based on the whole bunch even when one item remains.
        groups = {key: remaining for key, entries in groups.items()
                  if (remaining := [row for row in entries
                                    if not (row["status"] == "pending" and row["can_review"])])}
    if dashboard:
        if actor.role == "analyser":
            field, username = "analyser_username", actor.username
        elif actor.role == "user":
            field, username = "user", actor.username
        elif request.GET.get("user"):
            field, username = "user", request.GET["user"]
        else:
            field, username = "analyser_username", request.GET.get("analyser")
        if username:
            groups = {key: matching for key, entries in groups.items()
                      if (matching := [row for row in entries if row[field] == username])}
    return [{"bid_no": entries[0]["bid_no"].strip(), "products": sorted({r.get("product_kind", r["product"]) for r in entries}),
                "status": bunch_status(entries), "updated_at": max(r["updated_at"] for r in entries),
                "created_at": min(r["created_at"] for r in entries), "items": entries}
               for entries in groups.values()]


@require_GET
def bunch_bids(request):
    actor, error = _require_role(request, {"admin", "analyser"})
    if error:
        return error
    search = request.GET.get("q", "").strip()[:150]
    exact = request.GET.get("bid_no", "").strip()[:150]
    dashboard = request.GET.get("dashboard") == "1"
    results = bunch_groups(request, actor, search, exact, dashboard)
    results.sort(key=lambda group: group["updated_at"], reverse=True)
    status = request.GET.get("status", "all")
    if status not in ("all", "pending", "approved", "re-analyze", "rejected"):
        return JsonResponse({"error": "Invalid status."}, status=400)
    if status != "all" and dashboard:
        results = [group for group in results if group["status"] == status]
    elif status != "all":
        # Match the group's items so a mixed bunch remains discoverable in
        # each relevant status tab instead of hiding approved/rejected items.
        results = [group for group in results if any(row["status"] == status for row in group["items"])]
    count = len(results)
    try:
        page = max(1, int(request.GET.get("page", "1")))
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid page."}, status=400)
    pages = max(1, math.ceil(count / 10))
    page = min(page, pages)
    return JsonResponse({"results": results[(page - 1) * 10:page * 10], "count": count, "page": page, "pages": pages})
