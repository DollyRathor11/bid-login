import json
import re
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import ComponentOption, ComponentRate, ComponentRateHistory
from .Gem import _require_role


COMMON_GROUPS = {
    "RAM": "ram", "HDD": "hdd", "SSD": "ssd", "Operating System": "os",
    "DVD": "dvd", "Wi-Fi / Bluetooth": "wifi", "Keyboard & Mouse": "keyboard",
    "Warranty": "warranty",
}
GROUPS = {
    "desktop": {**COMMON_GROUPS, "Processor": "processor", "Motherboard": "motherboard", "Monitor": "monitor", "Cabinet": "cabinet"},
    "aio": {**COMMON_GROUPS, "Processor": "processor", "Motherboard": "motherboard", "Screen Size": "screen_size"},
    "workstation": {
        **COMMON_GROUPS, "Intel Processor": "processor", "Intel Xeon Processor": "processor",
        "AMD Threadripper Processor": "processor", "Intel Motherboard": "motherboard",
        "Intel Xeon Motherboard": "motherboard", "AMD Motherboard": "motherboard",
        "Registered RAM": "ram", "Graphics Card": "graphics", "Cabinet": "cabinet",
        "Power Supply": "power_supply", "Monitor": "monitor",
    },
}


def component_name_limit(product, category):
    if category in {"dvd", "warranty"} or (product == "desktop" and category == "cabinet"):
        return 50
    if product == "aio":
        return 100 if category == "screen_size" else 500
    return 255 if category in {"processor", "motherboard", "graphics"} else 100


@csrf_exempt
@require_http_methods(["GET", "POST"])
def component_options(request):
    if request.method == "GET":
        rows = ComponentOption.objects.all()
        product = request.GET.get("product")
        if product:
            if product not in GROUPS:
                return JsonResponse({"error": "Invalid product."}, status=400)
            rows = rows.filter(product=product)
        return JsonResponse({"options": list(rows.values("id", "product", "category", "group", "name"))})

    _, error = _require_role(request, {"admin"})
    if error:
        return error
    try:
        data = json.loads(request.body or "{}")
        if not isinstance(data, dict):
            raise ValueError
        product = str(data.get("product", "")).strip().lower()
        group = str(data.get("group", "")).strip()
        name = " ".join(str(data.get("name", "")).split())
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    category = GROUPS.get(product, {}).get(group)
    if not category or not name or len(name) > 500 or name.lower() in {"none", "select"}:
        return JsonResponse({"error": "Choose a valid product, specification and component name (up to 500 characters)."}, status=400)
    limit = component_name_limit(product, category)
    if len(name) > limit:
        return JsonResponse({"error": f"This specification name must be {limit} characters or fewer."}, status=400)
    if category == "processor":
        required = {"Intel Processor": ("Intel",), "Intel Xeon Processor": ("Xeon",), "AMD Threadripper Processor": ("Threadripper",)}.get(group, ("Intel", "AMD", "Gen", "Ultra"))
        if not any(word.lower() in name.lower() for word in required):
            return JsonResponse({"error": f"Include the processor family in the name: {' / '.join(required)}."}, status=400)
        # User dropdowns identify processor families by their canonical spelling.
        for family in ("Intel", "AMD", "Gen", "Ultra", "Xeon", "Threadripper"):
            name = re.sub(re.escape(family), lambda match, value=family: value, name, flags=re.IGNORECASE)
    if ComponentOption.objects.filter(product=product, category=category, name__iexact=name).exists():
        return JsonResponse({"error": "This component already exists."}, status=409)
    price = None
    if "price" in data:
        try:
            price = Decimal(str(data["price"]))
            if not price.is_finite() or price < 0 or price > Decimal("999999999999.99") or price != price.quantize(Decimal("0.01")):
                raise ValueError
        except (InvalidOperation, ValueError, TypeError):
            return JsonResponse({"error": "Enter a valid price with up to two decimal places (zero or greater)."}, status=400)
    try:
        with transaction.atomic():
            option = ComponentOption.objects.create(product=product, category=category, group=group, name=name)
            if price is not None:
                ComponentRate.objects.update_or_create(
                    product=product, category=category, component_name=name, defaults={"price": price},
                )
                ComponentRateHistory.objects.create(product=product, category=category, component_name=name, price=price)
    except IntegrityError:
        return JsonResponse({"error": "This component already exists."}, status=409)
    return JsonResponse({"option": {"id": option.id, "product": product, "category": category, "group": group, "name": name}}, status=201)
