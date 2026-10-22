from django.db import migrations, models


class Migration(migrations.Migration):
    """"auto_completed_after_bid_submission" is 35 characters; 30 was too short."""

    dependencies = [
        ("accounts", "0066_epbg_not_applicable"),
    ]

    operations = [
        migrations.AlterField(
            model_name="gembidassignmenthistory",
            name="action",
            field=models.CharField(max_length=50),
        ),
    ]
