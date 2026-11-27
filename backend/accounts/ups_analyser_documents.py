"""Generate analyser PDFs from the saved UPS review, not desktop specs."""
import textwrap

import fitz

from .ups_specs import ANALYSER_DOCS, SCHEMAS, specs_fields


def analyser_document(bid, doc_type):
    document = fitz.open()
    label = "Make in India - Local Content" if doc_type == "make_in_india" else dict(ANALYSER_DOCS)[doc_type]
    page = None
    y = 0

    def new_page():
        nonlocal page, y
        page = document.new_page()
        page.insert_text((48, 45), "Laps N Tabs Technology Pvt. Ltd.", fontsize=15, fontname="hebo", color=(0.1, 0.15, 0.25))
        page.insert_text((48, 72), f"UPS - {label}", fontsize=12, fontname="hebo", color=(0.1, 0.3, 0.7))
        page.draw_line((48, 85), (547, 85), color=(0.8, 0.85, 0.9))
        y = 108

    def write(text, bold=False):
        nonlocal y
        normalized = str(text).translate(str.maketrans({"≥": ">=", "≤": "<=", "—": "-", "–": "-", "’": "'"}))
        for paragraph in normalized.splitlines() or [""]:
            for line in textwrap.wrap(paragraph, width=82, break_long_words=True, break_on_hyphens=False) or [""]:
                if y > 780:
                    new_page()
                page.insert_text((48, y), line, fontsize=10, fontname="hebo" if bold else "helv")
                y += 15
        y += 5

    new_page()
    for title, value in (("Bid Number", bid.bid_no), ("Department", bid.dept_name), ("Organization", bid.organization),
                         ("Address", f"{bid.address}, {bid.pincode}"), ("UPS Type", SCHEMAS[bid.ups_type]["label"]),
                         ("Quantity", bid.qty), ("Bid Start Date", bid.start_date or "-"), ("Bid End Date", bid.end_date or "-")):
        write(f"{title}: {value}")
    if doc_type == "make_in_india":
        write(f"Model Number: {bid.model_number or '-'}")
        write(f"Local Content: {bid.local_content}%", bold=True)
        write("Local content details entered by the admin for this UPS bid.")
        return document
    write(f"Model Number: {bid.model_number or '-'}")
    section_titles = {
        "warranty": "Warranty Details",
        "technical_compliance": "Reviewed Technical Requirements",
        "data_sheet": "UPS Product Specifications",
    }
    write(section_titles[doc_type], bold=True)
    for field in specs_fields(bid.ups_type, bid.specs):
        value = bid.specs.get(field["key"])
        if not value or (doc_type == "warranty" and field["key"] not in ("warranty", "battery_warranty", "rating", "battery_type")):
            continue
        write(f"{field['label']}: {', '.join(value) if isinstance(value, list) else value}")
    for index, current in enumerate(document, 1):
        current.insert_text((48, 815), f"Bid: {bid.bid_no} | Page {index} of {len(document)}", fontsize=8, color=(0.4, 0.4, 0.4))
    return document
