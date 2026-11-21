def normalize_custom_specs(rows):
    if not isinstance(rows, list) or len(rows) > 100:
        raise ValueError("Additional specifications must contain at most 100 fields.")
    result, names = [], set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Enter a field name and value for each additional specification.")
        label, value = str(row.get("label", "")).strip(), str(row.get("value", "")).strip()
        if not label and not value:
            continue
        if not label or not value or len(label) > 150 or len(value) > 5000:
            raise ValueError("Enter a valid field name and value for each additional specification.")
        if label.casefold() in names:
            raise ValueError("Additional specification names must be unique.")
        names.add(label.casefold())
        result.append({"label": label, "value": value})
    return result
