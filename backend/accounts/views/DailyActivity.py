from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from ..dashboard_metrics import PRODUCTS, dashboard_status
from .Gem import _require_role
from .ProductDashboard import _filter_user, _model


@require_GET
def daily_activity(request):
    actor, error = _require_role(request, {"admin", "analyser", "user"})
    if error:
        return error
    product = request.GET.get("product", "all")
    if product != "all" and product not in PRODUCTS:
        return JsonResponse({"error": "Unknown product"}, status=400)
    today = timezone.localdate()
    sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    rows = {}
    for index in range(7):
        day = sunday + timedelta(days=index)
        rows[day.isoformat()] = {"date": day.isoformat(), "day": day.strftime("%a"), "total": 0, "pending": 0, "approved": 0, "reAnalyze": 0, "rejected": 0}
    for key in PRODUCTS if product == "all" else (product,):
        if actor.role == "admin":
            bids = _model(key).objects.exclude(status="draft")
            if request.GET.get("user"):
                bids = _filter_user(bids, request.GET["user"])
            elif request.GET.get("analyser"):
                bids = bids.filter(analyser_username=request.GET["analyser"])
        elif actor.role == "user":
            bids = _filter_user(_model(key).objects.exclude(status="draft"), actor.username)
        else:
            bids = _model(key).objects.exclude(status="draft")
        for bid in bids.filter(updated_at__date__gte=sunday, updated_at__date__lte=today):
            date = timezone.localtime(bid.updated_at).date().isoformat()
            if date in rows:
                rows[date]["total"] += 1
                rows[date][dashboard_status(bid)] += 1
    return JsonResponse(list(rows.values()), safe=False)
