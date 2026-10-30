"""Analyser's "Pricing Pending at Admin" page: the logged-in analyser's own
bids that they sent to Admin and Admin has not priced (approved) yet."""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from ..auth_identity import STAFF_ROLES, request_user
from ..models import DesktopBid, PrinterBid, WorkstationBid


def _pending_bids(product):
    """Bids waiting for Admin, per product, as each Admin approval list
    defines its Pending tab."""
    if product == "desktop":
        return DesktopBid.objects.filter(status="complete", review_status="reviewed")
    if product == "workstation":
        return WorkstationBid.objects.filter(status="complete", review_status="reviewed")
    if product == "printer":
        return PrinterBid.objects.filter(status="complete", review_status="reviewed")
    if product == "aio":
        from .Aio import AioBid, _ensure_table
        _ensure_table()
        return AioBid.objects.filter(status="analyzed")
    if product == "toner":
        from .Toner import TonerBid, _ensure_table
        _ensure_table()
        return TonerBid.objects.filter(status="analyzed")
    return None


def _model(bid, product):
    if product in ("aio", "toner"):
        return f"{bid.model_no or ''}{bid.model or ''}".strip()
    return bid.model_number or ""


PRODUCTS = ("desktop", "aio", "workstation", "printer", "toner")


def _rows(product, username):
    return [
        {
            "id": bid.id,
            "product": product,
            "bid_no": bid.bid_no or "",
            "dept_name": bid.dept_name or "",
            "model": _model(bid, product),
            "qty": bid.qty,
            "end_date": bid.date.isoformat() if bid.date else "",
            "submitted_on": bid.updated_at.isoformat() if bid.updated_at else "",
        }
        for bid in _pending_bids(product).filter(analyser_username__iexact=username).order_by("date", "-updated_at")
    ]


@require_http_methods(["GET"])
def pending_at_admin(request):
    """?product=<key> gives one product; without it, every product."""
    user = request_user(request)
    if not user:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if user.role not in STAFF_ROLES:
        return JsonResponse({"error": "You are not authorized for this action."}, status=403)
    product = (request.GET.get("product") or "").strip().lower()
    if product and product not in PRODUCTS:
        return JsonResponse({"error": "Unknown product."}, status=400)
    rows = [row for key in ((product,) if product else PRODUCTS) for row in _rows(key, user.username)]
    return JsonResponse({"results": rows})
