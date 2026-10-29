from django.db import migrations, models


class Migration(migrations.Migration):
    """Price boxes for Graphics Description and Additional Software on the
    Workstation admin form, like Desktop's."""

    dependencies = [
        ("accounts", "0067_assignment_history_action_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="workstationbid",
            name="graphics_description_price",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="workstationbid",
            name="additional_software_price",
            field=models.FloatField(default=0),
        ),
    ]
