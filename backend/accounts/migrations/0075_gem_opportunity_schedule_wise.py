from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0074_gem_representations"),
    ]

    operations = [
        migrations.AddField(
            model_name="gembidopportunity",
            name="schedule_wise",
            field=models.BooleanField(default=False),
        ),
    ]
