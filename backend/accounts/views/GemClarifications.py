import json
import re

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import GemBidResult, GemClarificationResult
from .Gem import _require_role
from .GemResults import _parse_datetime


def _clarification_data(result):
    return {
        "id": result.id,
        "bid_no": result.bid_no,
        "product_type": result.product_type,
        "item_name": result.item_name,
        "quantity": result.quantity,
        "department": result.department,
        "start_date": result.start_date.isoformat() if result.start_date else "",
        "end_date": result.end_date.isoformat() if result.end_date else "",
        "status": result.status,
        "technical_status": result.technical_status,
        "clarification_status": result.clarification_status,
        "is_pending": result.is_pending,
        "clarification_at": result.clarification_at.isoformat() if result.clarification_at else "",
        "history": result.history if isinstance(result.history, list) else [],
        "last_synced_at": result.last_synced_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def gem_clarification_results(request):
    user, error = _require_role(request, {"admin", "analyser", "management"})
    if error:
        return error

    if request.method == "GET":
        scope = GemClarificationResult.objects.all()
        product_type = request.GET.get("product", "").strip().lower()
        if product_type in dict(GemBidResult.PRODUCT_CHOICES):
            scope = scope.filter(product_type=product_type)
        results = scope.filter(is_pending=True) if request.GET.get("status") == "pending" else scope
        return JsonResponse({
            "summary": {
                "total": scope.count(),
                "pending": scope.filter(is_pending=True).count(),
            },
            "results": [_clarification_data(item) for item in results[:2000]],
        })

    if request.method == "DELETE":
        try:
            body = json.loads(request.body or "{}")
        except (TypeError, ValueError):
            return JsonResponse({"error": "Invalid JSON payload."}, status=400)
        raw_ids = body.get("ids", [])
        if not isinstance(raw_ids, list):
            return JsonResponse({"error": "ids must be a list."}, status=400)
        result_ids = []
        for value in raw_ids:
            try:
                result_ids.append(int(value))
            except (TypeError, ValueError):
                continue
        result_ids = list(dict.fromkeys(result_ids))
        if not result_ids:
            return JsonResponse({"error": "Select at least one bid."}, status=400)
        rows = GemClarificationResult.objects.filter(id__in=result_ids)
        deleted_ids = list(rows.values_list("id", flat=True))
        rows.delete()
        return JsonResponse({"deleted": len(deleted_ids), "deleted_ids": deleted_ids})

    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)
    rows = body.get("results", body if isinstance(body, list) else [])
    if not isinstance(rows, list):
        return JsonResponse({"error": "results must be a list."}, status=400)

    saved = []
    created = 0
    updated = 0
    rejections = []
    processed_bid_numbers = set()
    with transaction.atomic():
        for row in rows:
            bid_no = str(row.get("bid_no", "")).strip()
            if not bid_no:
                rejections.append({"bid_no": "", "reason": "missing_bid_no"})
                continue
            if bid_no in processed_bid_numbers:
                continue
            processed_bid_numbers.add(bid_no)
            history = row.get("history") if isinstance(row.get("history"), list) else []
            history = [item for item in history if isinstance(item, dict)]
            existing = GemClarificationResult.objects.filter(bid_no=bid_no).first()
            # An incomplete re-read must not wipe a history saved earlier.
            if not history and existing:
                history = existing.history
            if not history and not row.get("clarification_status"):
                rejections.append({"bid_no": bid_no, "reason": "missing_clarification_history"})
                continue
            product_type = str(row.get("product_type", "desktop")).lower()
            defaults = {
                "product_type": product_type if product_type in dict(GemBidResult.PRODUCT_CHOICES) else "other",
                "item_name": re.sub(r"^\s*s\s*:\s*", "", str(row.get("item_name", "")), flags=re.I)[:500],
                "quantity": row.get("quantity") or None,
                "department": str(row.get("department", "")),
                "start_date": _parse_datetime(row.get("start_date")),
                "end_date": _parse_datetime(row.get("end_date")),
                "status": str(row.get("status", "")).strip()[:150],
                "technical_status": str(row.get("technical_status", "")).strip()[:150],
                "clarification_status": str(row.get("clarification_status", "")).strip()[:150],
                "is_pending": bool(row.get("is_pending")),
                "clarification_at": _parse_datetime(row.get("clarification_at"))
                or (existing.clarification_at if existing else None),
                "history": history,
            }
            result, was_created = GemClarificationResult.objects.update_or_create(bid_no=bid_no, defaults=defaults)
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
        "frontend_visible": bool(saved),
    })


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_gem_clarification_result(request, result_id):
    user, error = _require_role(request, {"admin", "analyser", "management"})
    if error:
        return error
    result = GemClarificationResult.objects.filter(id=result_id).first()
    if not result:
        return JsonResponse({"error": "Clarification bid record not found."}, status=404)
    bid_no = result.bid_no
    result.delete()
    return JsonResponse({"deleted": True, "bid_no": bid_no})
