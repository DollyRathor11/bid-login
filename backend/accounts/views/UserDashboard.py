from datetime import timedelta

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from ..dashboard_metrics import PRODUCTS, dashboard_status
from .BunchBids import bunch_dashboard_status, bunch_groups
from .Gem import _require_role
from .GemAssignments import user_visible_assignments
from .ProductDashboard import _model


def _user_bid_activity(request, user, product):
    if product == "bunch":
        for group in bunch_groups(request, user, dashboard=True):
            yield bunch_dashboard_status(group), group["updated_at"]
        return
    for key in PRODUCTS if product == "all" else (product,):
        model = _model(key)
        ownership = Q(user_id=user.id)
        if any(field.name == "username" for field in model._meta.fields):
            ownership |= Q(user__isnull=True, username=user.username)
        bids = model.objects.filter(ownership).exclude(status="draft")
        for bid in bids.iterator():
            yield dashboard_status(bid), bid.updated_at or bid.created_at


@require_GET
def user_dashboard(request):
    user, error = _require_role(request, {"user"})
    if error:
        return error
    product = request.GET.get("product", "all")
    if product not in ("all", "bunch", *PRODUCTS):
        return JsonResponse({"error": "Unknown product"}, status=400)
    today = timezone.localdate()
    sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    daily = {}
    for index in range(7):
        day = sunday + timedelta(days=index)
        daily[day.isoformat()] = {"date": day.isoformat(), "day": day.strftime("%a"), "total": 0, "pending": 0, "approved": 0, "reAnalyze": 0, "rejected": 0}
    stats = {"total": 0, "pending": 0, "approved": 0, "reAnalyze": 0, "rejected": 0}
    for label, activity_at in _user_bid_activity(request, user, product):
        stats["total"] += 1
        stats[label] += 1
        if activity_at:
            day = timezone.localtime(activity_at).date().isoformat()
            if day in daily:
                daily[day]["total"] += 1
                daily[day][label] += 1
    # Match the user's current Bid To Be Participated list, not historical totals.
    assignments = user_visible_assignments(user)
    assigned_product = "bunch_bid" if product == "bunch" else product
    assigned = sum(1 for row in assignments if product == "all" or row.opportunity.product_type == assigned_product)
    return JsonResponse({"stats": stats, "assigned": assigned, "daily": list(daily.values())})
