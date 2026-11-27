import json
import re
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import UpsBid
from ..ups_document_library import ups_library_pdfs
from ..ups_specs import ANALYSER_DOCS, GENERAL_DOCS, SCHEMAS, specs_fields
from .Gem import _require_role


def serialize_ups(bid, request):
    return {
        "id": bid.pk, "bid_id": bid.pk, "product": "ups", "bid_no": bid.bid_no,
        "user": bid.user.username, "ups_type": bid.ups_type, "specs": bid.specs,
        **{key: getattr(bid, key) for key in ("dept_name", "organization", "address", "pincode", "qty", "atc", "status", "analyser_username", "analyser_note", "admin_username", "admin_note", "model_number", "selected_general_docs")},
        "start_date": bid.start_date, "end_date": bid.end_date,
        "unit_price": str(bid.unit_price) if bid.unit_price is not None else "",
        "local_content": str(bid.local_content) if bid.local_content is not None else "",
        "upload_document": request.build_absolute_uri(bid.upload_document.url) if bid.upload_document else "",
        "atc_special_document": request.build_absolute_uri(bid.atc_special_document.url) if bid.atc_special_document else "",
        "updated_at": bid.updated_at,
        "selected_analyser_docs": bid.selected_analyser_docs,
        "analysis_saved_at": bid.analysis_saved_at,
        **{"epbg": "", "epbg_price": "0", "freight_installation": "Yes", "freight_price": "0", "margin": "", "approved_price": "", **bid.admin_pricing},
    }


def validate_specs(ups_type, specs):
    if ups_type not in SCHEMAS or not isinstance(specs, dict):
        raise ValueError("Select a valid UPS type and configuration.")
    if ups_type == "online_with_battery" and specs.get("capacity_range") not in (None, "", "up_to_10", "above_10"):
        raise ValueError("Invalid UPS capacity range.")
    fields = specs_fields(ups_type, specs)
    allowed = {f["key"] for f in fields} | {"capacity_range"}
    if set(specs) - allowed:
        raise ValueError("Configuration contains fields for a different UPS type.")
    for f in fields:
        value = specs.get(f["key"], [] if f["kind"] == "multi" else "")
        if f["kind"] == "multi":
            if not isinstance(value, list) or any(not isinstance(v, str) for v in value):
                raise ValueError(f"Invalid {f['label']}.")
        elif not isinstance(value, str):
            raise ValueError(f"Invalid {f['label']}.")
        if f["required"] and not (value.strip() if isinstance(value, str) else value):
            raise ValueError(f"Please fill {f['label']}.")
        if len(str(value)) > 5000:
            raise ValueError(f"{f['label']} is too long.")


def validate_metadata(data):
    result = {}
    for key, label, limit in (("bid_no", "Bid Number", 150), ("dept_name", "Department Name", 255), ("organization", "Organization Name", 255), ("address", "Address", 5000), ("pincode", "Buyer Pincode", 6)):
        text = str(data.get(key, "")).strip()
        if not text or len(text) > limit:
            raise ValueError(f"Enter a valid {label}.")
        result[key] = text
    if not re.fullmatch(r"[1-9][0-9]{5}", result["pincode"]):
        raise ValueError("Enter a valid 6-digit buyer pincode.")
    try:
        qty = int(str(data.get("qty", "")))
    except (TypeError, ValueError):
        raise ValueError("Enter a valid quantity.")
    if not 1 <= qty <= 2147483647:
        raise ValueError("Quantity must be greater than 0.")
    result.update(qty=qty, atc=str(data.get("atc", ""))[:10000])
    for key in ("start_date", "end_date"):
        result[key] = date.fromisoformat(str(data[key])) if data.get(key) else None
    if result["start_date"] and result["end_date"] and result["end_date"] < result["start_date"]:
        raise ValueError("Bid end date cannot be before the start date.")
    return result


def decimal_value(value, label, minimum=None, maximum=None):
    try:
        number = Decimal(str(value))
        if not number.is_finite() or (minimum is not None and number < minimum) or (maximum is not None and number > maximum):
            raise InvalidOperation
        if number.as_tuple().exponent < -2:
            raise InvalidOperation
        return number
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Enter a valid {label} (up to 2 decimal places).")


def validate_file(file):
    if file and (file.size > 20 * 1024 * 1024 or not file.name.lower().endswith(".pdf")):
        raise ValueError("Upload a PDF file up to 20 MB.")
    if file:
        header = file.read(5)
        file.seek(0)
        if header != b"%PDF-":
            raise ValueError("The uploaded file must be a valid PDF.")


@require_http_methods(["GET"])
def ups_schema(request):
    actor, error = _require_role(request, {"user", "analyser", "admin"})
    if error:
        return error
    documents = [{"id": key, "label": path.stem} for key, path in ups_library_pdfs().items()]
    if actor.role != "user":
        documents.extend({"id": key, "label": label} for key, label in GENERAL_DOCS)
    return JsonResponse({"types": SCHEMAS, "documents": documents, "analyser_documents": [{"id": k, "label": v} for k, v in ANALYSER_DOCS]})


@csrf_exempt
@require_http_methods(["POST"])
def save_ups(request, bid_id=None):
    actor, error = _require_role(request, {"user"})
    if error:
        return error
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError("Invalid bid form.")
        metadata = validate_metadata(data)
        model = str(data.get("model_number") or "").strip()
        if len(model) > 150:
            raise ValueError("UPS model number cannot exceed 150 characters.")
        ups_type, specs = data.get("ups_type"), data.get("specs", {})
        validate_specs(ups_type, specs)
        with transaction.atomic():
            if bid_id:
                bid = UpsBid.objects.select_for_update().filter(pk=bid_id, user=actor, status="draft").first()
                if not bid:
                    return JsonResponse({"error": "Editable UPS draft not found."}, status=404)
                for key, value in metadata.items():
                    setattr(bid, key, value)
                bid.ups_type, bid.specs = ups_type, specs
            else:
                bid = UpsBid(user=actor, ups_type=ups_type, specs=specs, **metadata)
            bid.model_number = model
            bid.save()
        return JsonResponse(serialize_ups(bid, request), status=200 if bid_id else 201)
    except (ValueError, TypeError) as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def submit_ups_documents(request, bid_id):
    actor, error = _require_role(request, {"user"})
    if error:
        return error
    try:
        docs = json.loads(request.POST.get("selected_general_docs", "[]"))
        valid_docs = set(ups_library_pdfs()) | dict(GENERAL_DOCS).keys()
        if not isinstance(docs, list) or any(not isinstance(d, str) or d not in valid_docs for d in docs):
            raise ValueError("Select valid general documents.")
        upload = request.FILES.get("upload_document")
        special = request.FILES.get("atc_special_document")
        validate_file(upload)
        validate_file(special)
        with transaction.atomic():
            bid = UpsBid.objects.select_for_update().select_related("user").filter(pk=bid_id, user=actor).first()
            if not bid:
                return JsonResponse({"error": "UPS bid not found."}, status=404)
            if bid.status != "draft":
                return JsonResponse({"error": "This bid has already been submitted."}, status=409)
            if not docs and not special and not bid.atc_special_document:
                raise ValueError("Please select at least one document or upload the special document before submitting.")
            validate_specs(bid.ups_type, bid.specs)
            if upload:
                bid.upload_document = upload
            if special:
                bid.atc_special_document = special
            bid.selected_general_docs, bid.status = list(dict.fromkeys(docs)), "complete"
            bid.save()
        return JsonResponse(serialize_ups(bid, request))
    except (ValueError, TypeError) as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@require_http_methods(["GET"])
def ups_detail(request, bid_id):
    actor, error = _require_role(request, {"user", "analyser", "admin"})
    if error:
        return error
    queryset = UpsBid.objects.select_related("user")
    if actor.role == "user":
        queryset = queryset.filter(user=actor)
    else:
        queryset = queryset.exclude(status="draft")
    bid = queryset.filter(pk=bid_id).first()
    if not bid:
        return JsonResponse({"error": "UPS bid not found."}, status=404)
    return JsonResponse(serialize_ups(bid, request))


@csrf_exempt
@require_http_methods(["POST"])
def review_ups(request, bid_id):
    actor, error = _require_role(request, {"analyser", "admin"})
    if error:
        return error
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError("Invalid review form.")
        action = data.get("action")
        metadata_fields = ("bid_no", "dept_name", "organization", "address", "pincode", "qty", "atc", "start_date", "end_date")
        with transaction.atomic():
            bid = UpsBid.objects.select_for_update().select_related("user").filter(pk=bid_id).exclude(status="draft").first()
            if not bid:
                return JsonResponse({"error": "UPS bid not found."}, status=404)
            if actor.role == "analyser":
                if action not in ("save_analysis", "send_admin") or bid.status not in ("complete", "re-analyze"):
                    return JsonResponse({"error": "This bid is not pending analysis."}, status=409)
                if bid.analyser_username and bid.analyser_username != actor.username:
                    return JsonResponse({"error": "This UPS bid is being handled by another analyser."}, status=403)
                if action == "save_analysis":
                    model = str(data.get("model_number", bid.model_number) or "").strip()
                    if len(model) > 150:
                        raise ValueError("UPS model number cannot exceed 150 characters.")
                    specs = data.get("specs", bid.specs)
                    validate_specs(bid.ups_type, specs)
                    if any(key in data for key in metadata_fields):
                        metadata = validate_metadata({key: data.get(key, getattr(bid, key)) for key in metadata_fields})
                        for key, value in metadata.items():
                            setattr(bid, key, value)
                    bid.specs, bid.model_number = specs, model
                    bid.analyser_username = actor.username
                    bid.analysis_saved_at = timezone.now()
                    # Next saves the review but keeps it with the analyser.
                    # Only the final documents step sends it to the admin.
                else:
                    if not bid.analysis_saved_at:
                        raise ValueError("Save the UPS review using Next before completing analyser documents.")
                    docs = data.get("selected_analyser_docs")
                    if not isinstance(docs, list) or any(not isinstance(doc, str) or doc not in dict(ANALYSER_DOCS) for doc in docs):
                        raise ValueError("Complete the analyser documents step with valid document selections.")
                    validate_specs(bid.ups_type, bid.specs)
                    bid.selected_analyser_docs = list(dict.fromkeys(docs))
                    bid.analyser_username = actor.username
                    bid.status = "analyzed"
            else:
                if action not in ("approved", "re-analyze", "bid_rejected") or not (bid.status == "analyzed" or (bid.status == "approved" and action == "approved")):
                    return JsonResponse({"error": "Only bids sent by the analyser can be reviewed."}, status=409)
                if action in ("approved", "re-analyze"):
                    from ..ups_admin_pricing import validate_admin_pricing
                    bid.unit_price, bid.admin_pricing = validate_admin_pricing(data, bid, action)
                    metadata = validate_metadata({key: data.get(key, getattr(bid, key)) for key in metadata_fields})
                    for key, value in metadata.items():
                        setattr(bid, key, value)
                    specs = data.get("specs", bid.specs)
                    validate_specs(bid.ups_type, specs)
                    bid.specs = specs
                    model = str(data.get("model_number", bid.model_number) or "").strip()
                    if len(model) > 150:
                        raise ValueError("UPS model number cannot exceed 150 characters.")
                    bid.model_number = model
                if action == "approved" and "local_content" in data:
                    bid.local_content = decimal_value(data.get("local_content", bid.local_content), "Local Content percentage (0–100)", Decimal(0), Decimal(100))
                if action == "bid_rejected" and not str(data.get("note", "")).strip():
                    raise ValueError("Please enter the reason for rejecting this bid.")
                bid.admin_username, bid.admin_note = actor.username, str(data.get("note", ""))[:10000]
                bid.status = action
                if action == "re-analyze":
                    bid.analysis_saved_at = None
            bid.save()
        return JsonResponse(serialize_ups(bid, request))
    except (ValueError, TypeError) as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_approved_ups(request, bid_id=None):
    actor, error = _require_role(request, {"analyser"})
    if error:
        return error
    if bid_id is None:
        try:
            data = json.loads(request.body)
            ids = data.get("ids") if isinstance(data, dict) else None
            if not isinstance(ids, list) or not 1 <= len(ids) <= 500 or any(type(pk) is not int or pk < 1 for pk in ids):
                raise ValueError
        except (TypeError, ValueError):
            return JsonResponse({"error": "Select valid UPS bids to delete."}, status=400)
    else:
        ids = [bid_id]
    with transaction.atomic():
        queryset = UpsBid.objects.filter(pk__in=ids, status="approved")
        bids = list(queryset.select_for_update())
        if len(bids) != len(set(ids)):
            return JsonResponse({"error": "Approved UPS bid not found."}, status=404)
        if any(bid.analyser_username != actor.username for bid in bids):
            return JsonResponse({"error": "Only the assigned analyser can delete this UPS bid."}, status=403)
        queryset.delete()
    return JsonResponse({"message": "UPS bid deleted."})
