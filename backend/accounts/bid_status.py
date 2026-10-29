"""The admin's final "Reject Bid" decision, shown in the Rejected section.

Not "rejected": AIO and Toner already store that for a bid sent back for
re-analysis, so a final rejection has its own value in every product.
"""

BID_REJECTED = "bid_rejected"
# The ?status= key the admin and analyser Rejected sections ask for.
REJECTED_SECTION = "rejected"
