"""Shared membership rules for bunch and individual-product lists."""
from django.db.models.functions import Lower, Trim


def normalized_number(value):
    return str(value or "").strip().casefold()


def eligible_groups(rows):
    groups = {}
    for row in rows:
        key = normalized_number(row["bid_no"])
        if key:
            groups.setdefault(key, []).append(row)
    return {key: entries for key, entries in groups.items()
            if any(row["product"] == "ups" for row in entries)
            or len({row.get("product_kind", row["product"]) for row in entries}) > 1}


def exclude_bunch_bids(queryset):
    from .dashboard_metrics import PRODUCTS
    from .models import UpsBid
    from .views.ProductDashboard import _model

    queryset = queryset.annotate(_bunch_number=Lower(Trim("bid_no")))
    candidates = set(queryset.values_list("_bunch_number", flat=True)) - {"", None}
    if not candidates:
        return queryset
    rows = []
    # Look across every submitted status, so approval/re-analysis of one item
    # does not accidentally put another item back in an individual list.
    for product in PRODUCTS:
        matching = (_model(product).objects.exclude(status="draft")
                    .annotate(_bunch_number=Lower(Trim("bid_no")))
                    .filter(_bunch_number__in=candidates))
        columns = ("bid_no", "printer_type") if product == "printer" else ("bid_no",)
        for values in matching.values_list(*columns).distinct():
            kind = "multifunction_printer" if product == "printer" and "multifunction" in str(values[1]).lower() else product
            rows.append({"bid_no": values[0], "product": product, "product_kind": kind})
    ups = (UpsBid.objects.exclude(status="draft")
           .annotate(_bunch_number=Lower(Trim("bid_no")))
           .filter(_bunch_number__in=candidates))
    rows.extend({"bid_no": number, "product": "ups"} for number in ups.values_list("bid_no", flat=True).distinct())
    return queryset.exclude(_bunch_number__in=eligible_groups(rows))
