"""UPS-specific copies of the existing general document templates.

Original PDFs and the Desktop certificate implementation are never modified.
"""
import json
import re
from pathlib import Path
from uuid import uuid4

import fitz
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..models import UpsBid
from ..ups_specs import ANALYSER_DOCS, GENERAL_DOCS
from ..ups_analyser_documents import analyser_document
from .Gem import _require_role
from .Ups import decimal_value
from decimal import Decimal

PAGE_RANGES = {
    "manufacturer_auth": (2, 4), "bidder_financial": (7, 7),
    "non_obsolete": (8, 8), "non_malicious": (16, 16),
    "non_return_hdd": (17, 17), "non_blacklisting": (20, 20),
    "service_support": (25, 30), "ipv6": (21, 21), "preloaded_os": (22, 22),
}
STATIC = {"experience_certificate": "experience_certificate.pdf", "past_performance": "experience_certificate.pdf", "oem_annual_turnover": "oem_annual_turnover.pdf", "atc_acceptance_letter": "atc_acceptance_letter.pdf"}


def fit_text(page, rect, text, size=10):
    # insert_textbox does not draw when it cannot fit; retry at a smaller size.
    while size >= 6:
        remaining = page.insert_textbox(rect, text, fontsize=size, fontname="helv")
        if remaining >= 0:
            return
        size -= 0.5
    raise ValueError("Document text is too long for the template. Shorten the address and try again.")


def personalize(document, bid):
    for page in document:
        lines = [(fitz.Rect(line["bbox"]), " ".join(span["text"] for span in line["spans"]).strip())
                 for block in page.get_text("dict")["blocks"] if block.get("type") == 0
                 for line in block.get("lines", [])]
        to_line = next((rect for rect, text in lines if re.fullmatch(r"To\s*,?", text, re.I)), None)
        bid_line = next((rect for rect, text in lines if re.search(r"(?:Tender|Bid)\s*No\s*[:.\-]", text, re.I)), None)
        if to_line and bid_line and bid_line.y0 > to_line.y0:
            rect = fitz.Rect(min(to_line.x0, bid_line.x0) - 2, to_line.y0 - 2, page.rect.width - 45, bid_line.y1 + 5)
            page.add_redact_annot(rect, fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            address = f"{bid.address}, {bid.pincode}".strip(", ")
            text = f"To,\n{bid.dept_name}\n{bid.organization}\n{address}\n\nBid No: {bid.bid_no}    Dated: {bid.start_date or ''}"
            fit_text(page, rect, text)
        elif bid_line:
            rect = fitz.Rect(bid_line.x0 - 2, bid_line.y0 - 2, page.rect.width - 45, bid_line.y1 + 5)
            page.add_redact_annot(rect, fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            fit_text(page, rect, f"Bid No: {bid.bid_no}    Dated: {bid.start_date or ''}")
        # Replace only product references, leaving the template's declarations,
        # signatures, company details and annexures intact.
        for original, replacement in (("Acxxel Desktop and All in One", "Acxxel UPS"), ("Acxxel Desktops", "Acxxel UPS")):
            rects = page.search_for(original)
            for rect in rects:
                page.add_redact_annot(rect, fill=(1, 1, 1))
            if rects:
                page.apply_redactions(images=0, graphics=0)
                for rect in rects:
                    fit_text(page, fitz.Rect(rect.x0, rect.y0, rect.x1 + 1, rect.y1 + 4), replacement)


@csrf_exempt
@require_POST
def generate_ups_document(request, bid_id):
    actor, error = _require_role(request, {"user", "analyser", "admin"})
    if error:
        return error
    queryset = UpsBid.objects.all()
    queryset = queryset.filter(user=actor) if actor.role == "user" else queryset.exclude(status="draft")
    bid = queryset.filter(pk=bid_id).first()
    if not bid:
        return JsonResponse({"error": "UPS bid not found."}, status=404)
    try:
        data = json.loads(request.body)
        doc_type = data.get("doc_type") if isinstance(data, dict) else None
        if doc_type not in dict(GENERAL_DOCS) and doc_type not in dict(ANALYSER_DOCS) and doc_type != "make_in_india":
            raise ValueError("Select a valid document.")
        if doc_type == "make_in_india":
            if actor.role != "admin":
                return JsonResponse({"error": "Only admin can generate this certificate."}, status=403)
            bid.local_content = decimal_value(data.get("local_content", bid.local_content), "Local Content percentage (0-100)", Decimal(0), Decimal(100))
        if doc_type in dict(ANALYSER_DOCS) or doc_type == "make_in_india":
            if actor.role not in ("analyser", "admin"):
                return JsonResponse({"error": "Only staff can generate analyser documents."}, status=403)
            if doc_type != "make_in_india" and not bid.analysis_saved_at:
                raise ValueError("Save the UPS review using Next before generating analyser documents.")
            output_dir = Path(settings.MEDIA_ROOT) / "generated" / "ups"
            output_dir.mkdir(parents=True, exist_ok=True)
            filename = f"ups_{bid.pk}_{doc_type}_{uuid4().hex}.pdf"
            with analyser_document(bid, doc_type) as document:
                document.save(output_dir / filename)
            url = settings.MEDIA_URL.rstrip("/") + "/generated/ups/" + filename
            return JsonResponse({"pdf_url": request.build_absolute_uri(url)})
        root = Path(settings.MEDIA_ROOT)
        source = root / "templates" / "static_documents" / STATIC[doc_type] if doc_type in STATIC else root / "templates" / "documents.pdf"
        if not source.is_file():
            return JsonResponse({"error": "Document template is not available on this server."}, status=404)
        with fitz.open(source) as template, fitz.open() as document:
            if doc_type in PAGE_RANGES:
                first, last = PAGE_RANGES[doc_type]
                document.insert_pdf(template, from_page=first - 1, to_page=last - 1)
            else:
                document.insert_pdf(template)
            if doc_type in PAGE_RANGES or doc_type == "atc_acceptance_letter":
                personalize(document, bid)
            output_dir = root / "generated" / "ups"
            output_dir.mkdir(parents=True, exist_ok=True)
            filename = f"ups_{bid.pk}_{doc_type}_{uuid4().hex}.pdf"
            document.save(output_dir / filename)
        url = settings.MEDIA_URL.rstrip("/") + "/generated/ups/" + filename
        return JsonResponse({"pdf_url": request.build_absolute_uri(url)})
    except (ValueError, TypeError) as exc:
        return JsonResponse({"error": str(exc)}, status=400)
