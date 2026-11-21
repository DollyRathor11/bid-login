from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0074_ups_bid")]

    operations = [
        migrations.AddField(model_name="upsbid", name="selected_analyser_docs", field=models.JSONField(default=list)),
        migrations.AddField(model_name="upsbid", name="analysis_saved_at", field=models.DateTimeField(null=True, blank=True)),
    ]
