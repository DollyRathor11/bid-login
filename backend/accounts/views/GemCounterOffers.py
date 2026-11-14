import json
import re
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import GemBidResult, GemCounterOffer
from .Gem import _require_role
from .GemResults import _parse_datetime


def _price(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def _counter_offer_data(row):
    our_offer = float(row.our_offer) if row.our_offer is not None else None
    l1_price = float(row.l1_price) if row.l1_price is not None else None
    return {
        "id": row.id,
        "bid_no": row.bid_no,
        "ra_no": row.ra_no,
        "product_type": row.product_type,
        "item_name": row.item_name,
        "quantity": row.quantity,
        "department": row.department,
        "start_date": row.start_date.isoformat() if row.start_date else "",
        "end_date": row.end_date.isoformat() if row.end_date else "",
        "status": row.status,
        "technical_status": row.technical_status,
        "counter_offer_status": row.counter_offer_status,
        "our_offer": our_offer,
        "l1_price": l1_price,
        "difference": round(our_offer - l1_price, 2) if our_offer is not None and l1_price is not None else None,
        "items": row.items if isinstance(row.items, list) else [],
        "last_synced_at": row.last_synced_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def gem_counter_offers(request):
    user, error = _require_role(request, {"admin", "analyser", "management"})
    if error:
        return error

    if request.method == "GET":
        scope = GemCounterOffer.objects.all()
        product_type = request.GET.get("product", "").strip().lower()
        if product_type in dict(GemBidResult.PRODUCT_CHOICES):
            scope = scope.filter(product_type=product_type)
        return JsonResponse({
            "summary": {"total": scope.count()},
            "results": [_counter_offer_data(row) for row in scope[:2000]],
        })

    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    if request.method == "DELETE":
        ids = []
        for value in body.get("ids", []) if isinstance(body.get("ids"), list) else []:
            try:
                ids.append(int(value))
            except (TypeError, ValueError):
                continue
        if not ids:
            return JsonResponse({"error": "Select at least one bid."}, status=400)
        rows = GemCounterOffer.objects.filter(id__in=ids)
        deleted_ids = list(rows.values_list("id", flat=True))
        rows.delete()
        return JsonResponse({"deleted": len(deleted_ids), "deleted_ids": deleted_ids})

    rows = body.get("results", [])
    if not isinstance(rows, list):
        return JsonResponse({"error": "results must be a list."}, status=400)
    saved, created, updated, removed = [], 0, 0, 0
    rejections = []
    with transaction.atomic():
        for row in rows:
            if not isinstance(row, dict):
                continue
            bid_no = str(row.get("bid_no", "")).strip()
            if not re.fullmatch(r"GEM/\d{4}/B/\d+", bid_no):
                rejections.append({"bid_no": bid_no, "reason": "invalid_bid_no"})
                continue
            # Only pending counter offers are tracked; a decided or expired one
            # leaves the Match Price list.
            if not row.get("is_pending"):
                removed += GemCounterOffer.objects.filter(bid_no=bid_no).delete()[0]
                continue
            our_offer = _price(row.get("our_offer"))
            l1_price = _price(row.get("l1_price"))
            if l1_price is None:
                rejections.append({"bid_no": bid_no, "reason": "missing_l1_price"})
                continue
            items = [item for item in row.get("items") or [] if isinstance(item, dict)]
            product_type = str(row.get("product_type", "desktop")).lower()
            defaults = {
                "ra_no": str(row.get("ra_no", "")).strip()[:100],
                "product_type": product_type if product_type in dict(GemBidResult.PRODUCT_CHOICES) else "other",
                "item_name": re.sub(r"^\s*s\s*:\s*", "", str(row.get("item_name", "")), flags=re.I)[:500],
                "quantity": row.get("quantity") or None,
                "department": str(row.get("department", "")),
                "start_date": _parse_datetime(row.get("start_date")),
                "end_date": _parse_datetime(row.get("end_date")),
                "status": str(row.get("status", "")).strip()[:150],
                "technical_status": str(row.get("technical_status", "")).strip()[:150],
                "counter_offer_status": str(row.get("counter_offer_status", "")).strip()[:150],
                "our_offer": our_offer,
                "l1_price": l1_price,
                "items": items,
            }
            result, was_created = GemCounterOffer.objects.update_or_create(bid_no=bid_no, defaults=defaults)
            saved.append(result.bid_no)
            created += int(was_created)
            updated += int(not was_created)
    return JsonResponse({
        "saved": len(saved),
        "created": created,
        "updated": updated,
        "removed": removed,
        "rejected": len(rejections),
        "rejections": rejections,
        "bid_numbers": saved,
        "frontend_visible": bool(saved),
    })


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_gem_counter_offer(request, result_id):
    user, error = _require_role(request, {"admin", "analyser", "management"})
    if error:
        return error
    row = GemCounterOffer.objects.filter(id=result_id).first()
    if not row:
        return JsonResponse({"error": "Counter offer record not found."}, status=404)
    bid_no = row.bid_no
    row.delete()
    return JsonResponse({"deleted": True, "bid_no": bid_no})
