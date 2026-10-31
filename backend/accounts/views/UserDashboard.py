from datetime import timedelta

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from ..dashboard_metrics import dashboard_assignments, dashboard_status
from .Gem import _require_role
from .ProductDashboard import _model


@require_GET
def user_dashboard(request):
    user, error = _require_role(request, {"user"})
    if error:
        return error
    products = ("desktop", "aio", "workstation", "printer", "toner")
    product = request.GET.get("product", "all")
    if product != "all" and product not in products:
        return JsonResponse({"error": "Unknown product"}, status=400)
    today = timezone.localdate()
    sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    daily = {}
    for index in range(7):
        day = sunday + timedelta(days=index)
        daily[day.isoformat()] = {"date": day.isoformat(), "day": day.strftime("%a"), "total": 0, "pending": 0, "approved": 0, "reAnalyze": 0, "rejected": 0}
    stats = {"total": 0, "pending": 0, "approved": 0, "reAnalyze": 0, "rejected": 0}
    for key in products if product == "all" else (product,):
        model = _model(key)
        ownership = Q(user_id=user.id)
        if any(field.name == "username" for field in model._meta.fields):
            ownership |= Q(user__isnull=True, username=user.username)
        bids = model.objects.filter(ownership).exclude(status="draft")
        for bid in bids.iterator():
            label = dashboard_status(bid)
            stats["total"] += 1
            stats[label] += 1
            activity_at = bid.updated_at or bid.created_at
            if activity_at:
                day = timezone.localtime(activity_at).date().isoformat()
                if day in daily:
                    daily[day]["total"] += 1
                    daily[day][label] += 1
    # Assigned opportunities are separate from the bids the user has filled.
    assigned = dashboard_assignments(product).filter(assigned_to_id=user.id).count()
    return JsonResponse({"stats": stats, "assigned": assigned, "daily": list(daily.values())})
