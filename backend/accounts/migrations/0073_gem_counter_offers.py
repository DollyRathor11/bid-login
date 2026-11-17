from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0072_merge_componentoption_clarifications"),
    ]

    operations = [
        migrations.CreateModel(
            name="GemCounterOffer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bid_no", models.CharField(max_length=100, unique=True)),
                ("ra_no", models.CharField(blank=True, default="", max_length=100)),
                ("product_type", models.CharField(choices=[("desktop", "Desktop"), ("aio", "AIO"), ("workstation", "Workstation"), ("printer", "Printer"), ("other", "Other")], default="desktop", max_length=20)),
                ("item_name", models.CharField(blank=True, default="", max_length=500)),
                ("quantity", models.PositiveIntegerField(blank=True, null=True)),
                ("department", models.TextField(blank=True, default="")),
                ("start_date", models.DateTimeField(blank=True, null=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(blank=True, default="", max_length=150)),
                ("technical_status", models.CharField(blank=True, default="", max_length=150)),
                ("counter_offer_status", models.CharField(blank=True, default="", max_length=150)),
                ("our_offer", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("l1_price", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("items", models.JSONField(blank=True, default=list)),
                ("last_synced_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "gem_counter_offer_bids",
                "ordering": ["end_date", "-last_synced_at"],
            },
        ),
    ]
