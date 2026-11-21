from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0076_ups_analyser_documents")]
    operations = [migrations.AddField(model_name="upsbid", name="admin_pricing", field=models.JSONField(default=dict))]
