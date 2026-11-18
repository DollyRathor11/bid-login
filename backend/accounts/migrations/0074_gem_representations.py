from django.db import migrations, models


class Migration(migrations.Migration):
    """Bids with representations submitted from the "Representation" GeM login,
    read by the extension's My Representation scan."""

    dependencies = [
        ("accounts", "0073_gem_counter_offers"),
    ]

    operations = [
        migrations.CreateModel(
            name="GemRepresentationResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bid_no", models.CharField(max_length=100, unique=True)),
                ("product_type", models.CharField(choices=[("desktop", "Desktop"), ("aio", "AIO"), ("workstation", "Workstation"), ("printer", "Printer"), ("other", "Other")], default="desktop", max_length=20)),
                ("item_name", models.CharField(blank=True, default="", max_length=500)),
                ("quantity", models.PositiveIntegerField(blank=True, null=True)),
                ("department", models.TextField(blank=True, default="")),
                ("start_date", models.DateTimeField(blank=True, null=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("representations", models.JSONField(blank=True, default=list)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("last_synced_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "gem_representation_bids",
                "ordering": ["-submitted_at", "-last_synced_at"],
            },
        ),
    ]
