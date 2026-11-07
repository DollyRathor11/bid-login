from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0069_gem_clarification_results")]

    operations = [migrations.CreateModel(
        name="ComponentOption",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("product", models.CharField(max_length=30)),
            ("category", models.CharField(max_length=60)),
            ("group", models.CharField(max_length=100)),
            ("name", models.CharField(max_length=500)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
        ],
        options={
            "db_table": "custom_component_options",
            "ordering": ["product", "group", "name"],
            "constraints": [models.UniqueConstraint(fields=("product", "category", "name"), name="unique_custom_component_option")],
        },
    )]
