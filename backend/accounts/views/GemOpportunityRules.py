import re


PAC_ONLY_RE = re.compile(r"(?:\(\s*PAC\s*Only\s*\)|\bPAC\s*Only\b)", re.IGNORECASE)

# GeM's PDF text layer occasionally clips the right-hand side of a category
# (for example "Desktop Com" or "Multifunction P (MFP)").  These patterns
# accept only known clipped forms of the six approved categories; they do not
# use generic words such as "printer" or "desktop" that can occur elsewhere
# in a bid document.
ALLOWED_CATEGORY_PATTERNS = (
    ("entry_mid_desktop", "desktop", re.compile(
        r"^entry\s+and\s+mid\s+level\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$",
        re.IGNORECASE,
    )),
    ("high_end_desktop", "desktop", re.compile(
        r"^high\s+end\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$",
        re.IGNORECASE,
    )),
    ("aio", "aio", re.compile(
        r"^all\s+in\s+one\s+pc(?:\s*\(v2\))?$",
        re.IGNORECASE,
    )),
    ("workstation", "workstation", re.compile(
        r"^fixed\s+computer\s+workstation(?:\s*\(v\d+\))?$",
        re.IGNORECASE,
    )),
    ("toner", "toner", re.compile(
        r"^toner\s+cartridges?\s*(?:/|and)\s*ink\s+cartridges?$",
        re.IGNORECASE,
    )),
    ("printer", "printer", re.compile(
        r"^a4\b(?=[\s\S]*(?:multifunction|\bmfp\b))(?=[\s\S]*(?:printer|\bp\b))[\s\S]*$",
        re.IGNORECASE,
    )),
)


# UPS categories are received only inside a bunch bid, never on their own,
# and only under these exact GeM names.
BUNCH_ONLY_CATEGORY_PATTERNS = (
    ("line_interactive_ups", "ups", re.compile(
        r"^line\s+interactive\s+ups\s+with\s+avr\s*\(v2\)$",
        re.IGNORECASE,
    )),
    ("online_ups", "ups", re.compile(
        r"^online\s+ups\s*\(\s*(?:≤|<=|&le;|<|\?|�)\s*10\s*kva\s*\)\s+with(?:out)?\s+battery\s+conforming\s+to\s+is\s+16242\s*\(\s*part\s+1\s*\)$",
        re.IGNORECASE,
    )),
)


def has_pac_only(value):
    return bool(PAC_ONLY_RE.search(str(value or "")))


def clean_opportunity_item(value):
    text = " ".join(str(value or "").split())
    text = re.split(r"[\u0900-\u097f]", text, maxsplit=1)[0]
    q_markers = list(re.finditer(r"\(Q\d+\)", text, re.IGNORECASE))
    if q_markers:
        text = text[:q_markers[-1].end()]
    text = re.sub(r"\s*\(Q\d+\)\s*", "", text, flags=re.IGNORECASE)
    return re.sub(r"\s*,\s*", ", ", text).strip(" ,")[:500]


def _category_key_and_product(category, in_bunch=False):
    normalized = " ".join(str(category or "").split()).strip(" ,")
    patterns = ALLOWED_CATEGORY_PATTERNS + (BUNCH_ONLY_CATEGORY_PATTERNS if in_bunch else ())
    for category_key, product_type, pattern in patterns:
        if pattern.fullmatch(normalized):
            return category_key, product_type
    return None, None


def classify_opportunity_item(value):
    """Return category metadata, or None when any category is unsupported.

    A single-category bid must be one of the approved categories. A bunch bid
    (several categories) is kept when every category is approved or a UPS
    category and at least one is approved; its product type is that of its
    first approved category.
    """
    raw = str(value or "")
    if not raw.strip() or has_pac_only(raw):
        return None
    clean_name = clean_opportunity_item(raw)
    categories = [part.strip() for part in re.split(r"\s*,\s*", clean_name) if part.strip()]
    if not categories:
        return None
    is_bunch = len(categories) > 1
    classified = [_category_key_and_product(category, is_bunch) for category in categories]
    if any(category_key is None for category_key, _ in classified):
        return None
    primary = next((product_type for _, product_type in classified if product_type != "ups"), None)
    if not primary:
        return None
    return {
        "clean_name": clean_name,
        "categories": categories,
        "category_keys": [category_key for category_key, _ in classified],
        "product_type": primary,
        "is_bunch": is_bunch,
    }
