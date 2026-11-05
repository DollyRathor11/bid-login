"""Normalise GeM Clarification History rows and drop expired clarifications.

The GeM popup is read cell by cell, so a history often arrives as a flat list
of single-key rows ({"Type": "<cell>"}): query, optional "View file", status,
and for a completed clarification the response date, response and file. Those
cells are regrouped into one entry per clarification.
"""
import re
from datetime import datetime, timedelta, timezone as dt_timezone

STATUS_RE = re.compile(r"^(pending|expired|completed|responded|submitted|closed|open)$", re.I)
DATE_RE = re.compile(r"^\d{1,2}[-/]\d{1,2}[-/]\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$")
FILE_RE = re.compile(r"^view\s+file$", re.I)
IST = dt_timezone(timedelta(hours=5, minutes=30))


def _group_cells(cells):
    items = []
    current = None
    for cell in cells:
        cell = str(cell or "").strip()
        if not cell:
            continue
        if STATUS_RE.match(cell):
            if current is None or "Status" in current:
                current = {}
                items.append(current)
            current["Status"] = cell.title()
        elif DATE_RE.match(cell):
            if current is None:
                current = {}
                items.append(current)
            current["Response Date"] = cell
        elif FILE_RE.match(cell):
            if current is None:
                current = {}
                items.append(current)
            current["Response File" if "Status" in current else "Query File"] = cell
        else:
            starts_new = current is None or (
                "Status" in current and (current["Status"] != "Completed" or "Response" in current)
            )
            if starts_new:
                current = {"Query": cell}
                items.append(current)
            elif "Status" in current:
                current["Response"] = cell
            elif "Query" in current:
                current["Query"] = f"{current['Query']} {cell}"
            else:
                current["Query"] = cell
    return items


def _status_of(item):
    for key, value in item.items():
        if re.search(r"status", key, re.I):
            return str(value or "").strip()
    return ""


def normalise_history(history):
    rows = [row for row in (history or []) if isinstance(row, dict)]
    if rows and all(len(row) == 1 for row in rows):
        rows = _group_cells([next(iter(row.values())) for row in rows])
    return rows


def without_expired(history):
    return [item for item in normalise_history(history) if not re.match(r"^expired$", _status_of(item), re.I)]


def parse_cell_date(value):
    value = str(value or "").strip()
    for fmt in ("%d-%m-%Y %H:%M", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=IST)
        except ValueError:
            continue
    return None


def summarise(items):
    statuses = [_status_of(item).lower() for item in items]
    dates = [
        parsed
        for item in items
        for value in item.values()
        if (parsed := parse_cell_date(value))
    ]
    if any(status in {"pending", "open"} for status in statuses):
        label = "Pending Clarification"
    elif any(status in {"completed", "responded", "submitted"} for status in statuses):
        label = "Clarification Submitted"
    else:
        label = ""
    return {
        "is_pending": label == "Pending Clarification",
        "clarification_status": label,
        "clarification_at": max(dates) if dates else None,
    }
