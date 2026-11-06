from decimal import Decimal, InvalidOperation


COMMON = ("processor", "ram", "hdd", "motherboard", "os", "dvd", "wifi", "keyboard", "warranty")
FIELDS = {
    "desktop": (*COMMON, "ssd1", "ssd2", "monitor", "cabinet"),
    "aio": (*COMMON, "ssd", "screen_size"),
    "workstation": ("processor", "ram", "hdd", "ssd1", "ssd2", "graphics", "motherboard", "os", "monitor", "cabinet", "keyboard", "power_supply", "warranty"),
}
LABELS = {"ram": "RAM", "os": "OS", "hdd": "Hard Disk Drive", "ssd": "Solid State Drive", "ssd1": "Solid State Drive 1", "ssd2": "Solid State Drive 2", "graphics": "Graphics Card", "screen_size": "Screen Size", "power_supply": "Power Supply"}


def epbg_price_error(data, bid):
    value = data.get("epbg", getattr(bid, "epbg", None))
    text = str(value if value is not None else "").strip().removesuffix("%").strip()
    if not text:
        return {"error": "Please enter EPBG percentage: 0, a positive number, or NA.", "field": "epbg"}
    if text.lower() in {"na", "n/a", "n.a", "n.a.", "not applicable"}:
        return None
    try:
        percentage = Decimal(text)
        if not percentage.is_finite() or percentage < 0:
            raise InvalidOperation
    except (InvalidOperation, ValueError):
        return {"error": "Please enter a valid EPBG percentage or NA.", "field": "epbg"}
    if percentage == 0:
        return None
    raw_price = data.get("epbg_price", getattr(bid, "epbg_price", 0))
    try:
        price = Decimal(str(raw_price).strip().replace(",", ""))
        if not price.is_finite() or price <= 0:
            raise InvalidOperation
    except (InvalidOperation, ValueError):
        return {"error": "Please enter an EPBG price greater than 0 when EPBG percentage is greater than 0.", "field": "epbg_price"}
    return None


def unpriced_main_component(product, data, bid, validate_hdd=False):
    """Validate selected main specs only; optional descriptions are unchanged."""
    for field in FIELDS[product]:
        model_field = "graphic_card" if field == "graphics" else field
        price_field = "screen_price" if field == "screen_size" else field + "_price"
        model_price_field = "graphic_card_price" if field == "graphics" else price_field
        previous_choice = getattr(bid, model_field, "")
        choice = data.get(field, data.get(model_field, previous_choice))
        if field == "ssd1" and field not in data and "ssd" in data:
            choice = data["ssd"]
        text = str(choice or "").strip()
        if not text or text.lower() == "none":
            continue
        if price_field in data:
            raw_price = data[price_field]
        elif model_price_field in data:
            raw_price = data[model_price_field]
        elif field == "ssd1" and "ssd_price" in data:
            raw_price = data["ssd_price"]
        else:
            raw_price = getattr(bid, model_price_field, 0) if choice == previous_choice else 0
        try:
            price = Decimal(str(raw_price).strip().replace(",", ""))
            free_integrated = product == "aio" and field == "motherboard" and text.startswith("Integrated") and price == 0
            if not price.is_finite() or (price <= 0 and not free_integrated):
                raise InvalidOperation
        except (InvalidOperation, ValueError):
            return {"error": f"Please enter a valid price greater than 0 for {LABELS.get(field, field.replace('_', ' ').title())}.", "field": price_field}
    if validate_hdd:
        option = data.get("hddreturnable", data.get("hdd_non_return", getattr(bid, "hdd_non_return" if product == "workstation" else "hddreturnable", "None")))
        if str(option).strip().lower() == "yes":
            raw_price = data.get("hddreturnable_price", data.get("hdd_non_return_price", getattr(bid, "hdd_non_return_price" if product == "workstation" else "hddreturnable_price", 0)))
            try:
                price = Decimal(str(raw_price).strip().replace(",", ""))
                if not price.is_finite() or price <= 0:
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                return {"error": "Please enter a valid HDD Return Option price greater than 0.", "field": "hddreturnable_price"}
    return epbg_price_error(data, bid)
