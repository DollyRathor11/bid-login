from decimal import Decimal
from types import SimpleNamespace

from .approval_prices import epbg_price_error


def validate_admin_pricing(data, bid, action):
    from .views.Ups import decimal_value

    maximum = Decimal("999999999999.99")
    saved = {"epbg": "", "epbg_price": "0", "freight_installation": "Yes", "freight_price": "0", "margin": "", "approved_price": "", **bid.admin_pricing}
    values = {key: data.get(key, value) for key, value in saved.items()}
    # Unit price and margin are no longer inputs in the UPS admin form.
    unit = bid.unit_price
    error = epbg_price_error(values, SimpleNamespace())
    if error:
        raise ValueError(error["error"])
    epbg = str(values["epbg"]).strip().removesuffix("%").strip()
    no_epbg = epbg.lower() in {"na", "n/a", "n.a", "n.a.", "not applicable"} or Decimal(epbg) == 0
    epbg_price = Decimal(0) if no_epbg else decimal_value(values["epbg_price"], "EPBG price greater than 0", Decimal("0.01"), maximum)
    freight = str(values["freight_installation"])
    if freight not in ("Yes", "No", "None"):
        raise ValueError("Select Yes or None for Freight & Installation.")
    freight_price = Decimal(0) if freight in ("No", "None") else decimal_value(values["freight_price"], "Freight & Installation price (0 or greater)", Decimal(0), maximum)
    approved = values["approved_price"]
    if action == "approved":
        approved = decimal_value(approved, "Bid Approved Price greater than 0", Decimal("0.01"), maximum)
    else:
        approved = bid.admin_pricing.get("approved_price", "")
    return unit, {
        "epbg": epbg, "epbg_price": str(epbg_price), "freight_installation": freight,
        "freight_price": str(freight_price),
        "approved_price": str(approved) if approved is not None else "",
    }
