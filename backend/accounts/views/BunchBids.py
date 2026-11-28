"""Bunch bid grouping and approved bid actions."""
import json
import math
from pathlib import Path
from textwrap import wrap

import fitz
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from ..dashboard_metrics import PRODUCTS, dashboard_status
from ..bunch_membership import eligible_groups, normalized_number
from ..models import UpsBid
from .Gem import _require_role
from .ProductDashboard import _model
from .Ups import serialize_ups


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_approved_bunch_bids(request):
    actor, error = _require_role(request, {"admin"})
    if error:
        return error
    try:
        body = json.loads(request.body)
        numbers = body.get("bid_numbers") if isinstance(body, dict) else None
        if not isinstance(numbers, list) or not 1 <= len(numbers) <= 100 or any(
            not isinstance(number, str) or not number.strip() or len(number.strip()) > 150 for number in numbers
        ):
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({"error": "Select valid bunch bids to delete."}, status=400)

    with transaction.atomic():
        bids = []
        for number in sorted({normalized_number(number) for number in numbers}):
            groups = bunch_groups(request, actor, exact=number)
            approved = [item for group in groups for item in group["items"] if item["status"] == "approved"]
            if not approved:
                return JsonResponse({"error": "An approved bunch bid is no longer available. Refresh and try again."}, status=409)
            for item in approved:
                product = item["product"]
                model = UpsBid if product == "ups" else _model(product)
                bid = model.objects.select_for_update().filter(pk=item["id"]).first()
                if (bid is None or normalized_number(bid.bid_no) != number
                    or (bid.status if product == "ups" else dashboard_status(bid)) != "approved"):
                    return JsonResponse({"error": "An approved product changed. Refresh and try again."}, status=409)
                bids.append(bid)
        for bid in bids:
            bid.delete()
    return JsonResponse({"deleted_products": len(bids)})


@require_GET
def approved_bunch_price_paper(request):
    actor, error = _require_role(request, {"analyser"})
    if error:
        return error
    bid_no = request.GET.get("bid_no", "").strip()
    if not bid_no or len(bid_no) > 150:
        return JsonResponse({"error": "Enter a valid bid number."}, status=400)
    groups = bunch_groups(request, actor, exact=bid_no)
    product_names = {
        "desktop": "Desktop", "aio": "AIO", "workstation": "Workstation",
        "printer": "Printer", "multifunction_printer": "Multifunction Printer",
        "toner": "Toner", "ups": "UPS",
    }
    items = []
    for item in (item for group in groups for item in group["items"] if item["status"] == "approved"):
        product = item["product"]
        model = UpsBid if product == "ups" else _model(product)
        bid = model.objects.filter(pk=item["id"]).first()
        if bid is None or (bid.status if product == "ups" else dashboard_status(bid)) != "approved":
            continue
        price = (bid.admin_pricing.get("approved_price") or bid.unit_price) if product == "ups" else (
            getattr(bid, "total_price", None) or getattr(bid, "final_amount", None)
        )
        items.append({
            "id": item["id"], "product": product, "product_name": product_names[item.get("product_kind", product)],
            "bid_no": item["bid_no"], "model_number": item["model_number"],
            "final_price": str(price) if price is not None else "",
        })
    if not items:
        return JsonResponse({"error": "No approved products found for this bunch bid."}, status=404)
    if request.GET.get("format") == "json":
        return JsonResponse({"items": items})

    header = signature = None
    template_path = Path(settings.MEDIA_ROOT) / "templates" / "documents.pdf"
    if template_path.is_file():
        with fitz.open(template_path) as template:
            source = template[5] if len(template) > 5 else template[0]
            header = source.get_pixmap(matrix=fitz.Matrix(2, 2), clip=fitz.Rect(0, 0, source.rect.width, 112)).tobytes("png")
            images = source.get_images(full=True)
            if len(images) > 1:
                signature = template.extract_image(images[1][0])["image"]
    with fitz.open() as document:
        for item in items:
            page = document.new_page(width=595, height=842)
            if header:
                page.insert_image(fitz.Rect(48, 20, 547, 115), stream=header, keep_proportion=False)
            page.insert_textbox(fitz.Rect(48, 150, 547, 174), "APPROVED DETAILS FOR BIDDING", fontsize=14, fontname="hebo", align=1)
            details = (
                ("Bid No.", item["bid_no"]), ("Product", item["product_name"]),
                ("Model No.", item["model_number"] or "-"),
                ("Final Price", f"INR {item['final_price']}" if item["final_price"] else "-"),
            )
            y = 195
            for label, value in details:
                value = "\n".join(wrap(value, width=49))
                height = max(32, 16 + 13 * len(value.splitlines()))
                label_box = fitz.Rect(48, y, 238, y + height)
                value_box = fitz.Rect(238, y, 547, y + height)
                page.draw_rect(label_box, color=(0.58, 0.64, 0.72), fill=(0.92, 0.94, 0.97))
                page.draw_rect(value_box, color=(0.58, 0.64, 0.72))
                page.insert_textbox(label_box + (10, 8, -8, -2), label, fontsize=11, fontname="hebo")
                page.insert_textbox(value_box + (10, 8, -8, -2), value, fontsize=11)
                y += height
            page.draw_line((48, y + 65), (310, y + 65), color=(0.75, 0.79, 0.84))
            page.insert_text((48, y + 83), "Auth. Signatory For Laps N Tabs Technology Pvt. Ltd.", fontsize=9, fontname="hebo")
            if signature:
                page.insert_image(fitz.Rect(48, y + 92, 200, y + 138), stream=signature)
            page.insert_text((48, y + 154), "Name:- Devank Rastogi\nDesignation:- Director\nEmail:- lapsntabs123@gmail.com\nContact No.:- 9918200166", fontsize=9)
        return HttpResponse(document.tobytes(), content_type="application/pdf")

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
        if actor.role == "analyser" and bid.status == "approved":
            row["can_delete"] = bid.analyser_username == actor.username
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
