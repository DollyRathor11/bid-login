from .bid_status import BID_REJECTED
from .models import GemBidAssignment

PRODUCTS = ("desktop", "aio", "workstation", "printer", "toner")


def analyser_dashboard_bids(model, actor):
    return model.objects.exclude(status="draft").filter(analyser_username=actor.username)


def dashboard_assignments(product="all"):
    """Total assignments include completed and hidden rows, in both dashboards."""
    rows = GemBidAssignment.objects.all()
    if product != "all":
        rows = rows.filter(opportunity__product_type=product)
    return rows


def dashboard_status(bid):
    if hasattr(bid, "review_status"):
        return {"approved": "approved", "re-analyze": "reAnalyze", BID_REJECTED: "rejected"}.get(bid.review_status, "pending")
    return {"approved": "approved", "rejected": "reAnalyze", "re-analyze": "reAnalyze", BID_REJECTED: "rejected"}.get(bid.status, "pending")
