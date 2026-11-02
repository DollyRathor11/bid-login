from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from ..dashboard_metrics import PRODUCTS, analyser_dashboard_bids, dashboard_status
from .Gem import _require_role
from .ProductDashboard import _model


@require_GET
def analyser_dashboard(request):
    actor, error = _require_role(request, {"analyser"})
    if error:
        return error
    product = request.GET.get("product", "desktop")
    if product not in PRODUCTS:
        return JsonResponse({"error": "Unknown product"}, status=400)
    try:
        year = int(request.GET.get("year") or timezone.localdate().year)
        if not 1 <= year <= 9999:
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid year"}, status=400)
    stats = {"total": 0, "pending": 0, "approved": 0, "reAnalyze": 0, "rejected": 0}
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly = [{"month": month, "monthNumber": index + 1, **{key: 0 for key in stats}} for index, month in enumerate(months)]
    years = {timezone.localdate().year, year}
    for bid in analyser_dashboard_bids(_model(product), actor).iterator():
        label = dashboard_status(bid)
        stats["total"] += 1
        stats[label] += 1
        if bid.created_at:
            created = timezone.localtime(bid.created_at)
            years.add(created.year)
            if created.year == year:
                monthly[created.month - 1]["total"] += 1
                monthly[created.month - 1][label] += 1
    return JsonResponse({"stats": stats, "monthly": monthly, "years": sorted(years, reverse=True)})
