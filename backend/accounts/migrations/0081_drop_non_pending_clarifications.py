from django.db import migrations


def drop_non_pending(apps, schema_editor):
    # Only pending clarifications are tracked from now on.
    apps.get_model("accounts", "GemClarificationResult").objects.filter(is_pending=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0080_merge_schedule_wise_ups"),
    ]

    operations = [
        migrations.RunPython(drop_non_pending, migrations.RunPython.noop),
    ]
