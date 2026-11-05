from django.db import migrations

from accounts.clarification_history import summarise, without_expired


def drop_expired_clarifications(apps, schema_editor):
    GemClarificationResult = apps.get_model("accounts", "GemClarificationResult")
    for result in GemClarificationResult.objects.all():
        kept = without_expired(result.history)
        if not kept:
            result.delete()
            continue
        summary = summarise(kept)
        result.history = kept
        if summary["clarification_status"]:
            result.clarification_status = summary["clarification_status"]
            result.is_pending = summary["is_pending"]
        if summary["clarification_at"]:
            result.clarification_at = summary["clarification_at"]
        result.save(update_fields=["history", "clarification_status", "is_pending", "clarification_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0069_gem_clarification_results"),
    ]

    operations = [
        migrations.RunPython(drop_expired_clarifications, migrations.RunPython.noop),
    ]
