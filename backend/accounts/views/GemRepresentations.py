import json
import re

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import GemBidResult, GemRepresentationResult
from .Gem import _require_role
from .GemResults import _parse_datetime


def _representation_data(result):
    return {
        "id": result.id,
        "bid_no": result.bid_no,
        "product_type": result.product_type,
        "item_name": result.item_name,
        "quantity": result.quantity,
        "department": result.department,
        "start_date": result.start_date.isoformat() if result.start_date else "",
        "end_date": result.end_date.isoformat() if result.end_date else "",
        "representations": result.representations if isinstance(result.representations, list) else [],
        "submitted_at": result.submitted_at.isoformat() if result.submitted_at else "",
        "last_synced_at": result.last_synced_at.isoformat(),
    }


def _clean_rows(value):
    """Rows of the My Representations table, with blank rows dropped."""
    rows = []
    for row in value if isinstance(value, list) else []:
        if not isinstance(row, dict):
            continue
        entry = {
            "bid_section": str(row.get("bid_section", "")).strip(),
            "representation": str(row.get("representation", "")).strip(),
            "submitted_on": str(row.get("submitted_on", "")).strip(),
        }
        if entry["representation"]:
            rows.append(entry)
    return rows


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def gem_representation_results(request):
    user, error = _require_role(request, {"admin", "analyser", "management"})
    if error:
        return error

    if request.method == "GET":
        scope = GemRepresentationResult.objects.all()
        product_type = request.GET.get("product", "").strip().lower()
        if product_type in dict(GemBidResult.PRODUCT_CHOICES):
            scope = scope.filter(product_type=product_type)
        return JsonResponse({
            "summary": {"total": scope.count()},
            "results": [_representation_data(item) for item in scope[:2000]],
        })

    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    if request.method == "DELETE":
        raw_ids = body.get("ids", [])
        if not isinstance(raw_ids, list):
            return JsonResponse({"error": "ids must be a list."}, status=400)
        result_ids = []
        for value in raw_ids:
            try:
                result_ids.append(int(value))
            except (TypeError, ValueError):
                continue
        if not result_ids:
            return JsonResponse({"error": "Select at least one bid."}, status=400)
        rows = GemRepresentationResult.objects.filter(id__in=result_ids)
        deleted_ids = list(rows.values_list("id", flat=True))
        rows.delete()
        return JsonResponse({"deleted": len(deleted_ids), "deleted_ids": deleted_ids})

    rows = body.get("results", body if isinstance(body, list) else [])
    if not isinstance(rows, list):
        return JsonResponse({"error": "results must be a list."}, status=400)

    saved = []
    created = 0
    updated = 0
    rejections = []
    with transaction.atomic():
        for row in rows:
            if not isinstance(row, dict):
                continue
            bid_no = str(row.get("bid_no", "")).strip()
            if not bid_no:
                rejections.append({"bid_no": "", "reason": "missing_bid_no"})
                continue
            representations = _clean_rows(row.get("representations"))
            # A bid whose My Representations table is empty is not tracked.
            if not representations:
                rejections.append({"bid_no": bid_no, "reason": "no_representations"})
                continue
            product_type = str(row.get("product_type", "desktop")).lower()
            defaults = {
                "product_type": product_type if product_type in dict(GemBidResult.PRODUCT_CHOICES) else "other",
                "item_name": re.sub(r"^\s*s\s*:\s*", "", str(row.get("item_name", "")), flags=re.I)[:500],
                "quantity": row.get("quantity") or None,
                "department": str(row.get("department", "")),
                "start_date": _parse_datetime(row.get("start_date")),
                "end_date": _parse_datetime(row.get("end_date")),
                "representations": representations,
                "submitted_at": _parse_datetime(row.get("submitted_at")),
            }
            result, was_created = GemRepresentationResult.objects.update_or_create(bid_no=bid_no, defaults=defaults)
            saved.append(result.bid_no)
            created += int(was_created)
            updated += int(not was_created)
    return JsonResponse({
        "saved": len(saved),
        "created": created,
        "updated": updated,
        "rejected": len(rejections),
        "rejections": rejections,
        "bid_numbers": saved,
    })
