from django.db import migrations, models


class Migration(migrations.Migration):
    """Bids on which the GeM buyer sought clarification, read by the
    extension's Clarification scan."""

    dependencies = [
        ("accounts", "0068_workstation_description_prices"),
    ]

    operations = [
        migrations.CreateModel(
            name="GemClarificationResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bid_no", models.CharField(max_length=100, unique=True)),
                ("product_type", models.CharField(
                    choices=[("desktop", "Desktop"), ("aio", "AIO"), ("workstation", "Workstation"), ("printer", "Printer"), ("other", "Other")],
                    default="desktop", max_length=20,
                )),
                ("item_name", models.CharField(blank=True, default="", max_length=500)),
                ("quantity", models.PositiveIntegerField(blank=True, null=True)),
                ("department", models.TextField(blank=True, default="")),
                ("start_date", models.DateTimeField(blank=True, null=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(blank=True, default="", max_length=150)),
                ("technical_status", models.CharField(blank=True, default="", max_length=150)),
                ("clarification_status", models.CharField(blank=True, default="", max_length=150)),
                ("is_pending", models.BooleanField(default=False)),
                ("clarification_at", models.DateTimeField(blank=True, null=True)),
                ("history", models.JSONField(blank=True, default=list)),
                ("last_synced_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "gem_clarification_bid_results",
                "ordering": ["-clarification_at", "-last_synced_at"],
            },
        ),
    ]
