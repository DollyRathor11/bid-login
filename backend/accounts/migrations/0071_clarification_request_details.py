from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0070_drop_expired_clarifications"),
    ]

    operations = [
        migrations.AddField(
            model_name="gemclarificationresult",
            name="request_details",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="gemclarificationresult",
            name="last_response_date",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
