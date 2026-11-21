from django.db import models


class UpsBid(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="ups_bids")
    bid_no = models.CharField(max_length=150, db_index=True)
    dept_name = models.CharField(max_length=255)
    organization = models.CharField(max_length=255)
    address = models.TextField()
    pincode = models.CharField(max_length=6)
    qty = models.PositiveIntegerField(default=1)
    atc = models.TextField(blank=True, default="")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    ups_type = models.CharField(max_length=40)
    specs = models.JSONField(default=dict)
    upload_document = models.FileField(upload_to="ups/bid_documents/", blank=True)
    atc_special_document = models.FileField(upload_to="ups/special_documents/", blank=True)
    selected_general_docs = models.JSONField(default=list)
    selected_analyser_docs = models.JSONField(default=list)
    analysis_saved_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, default="draft", db_index=True)
    analyser_username = models.CharField(max_length=150, blank=True, default="")
    analyser_note = models.TextField(blank=True, default="")
    admin_username = models.CharField(max_length=150, blank=True, default="")
    admin_note = models.TextField(blank=True, default="")
    model_number = models.CharField(max_length=150, blank=True, default="")
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    local_content = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    admin_pricing = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ups_bid_details"
        ordering = ["-updated_at", "-pk"]
