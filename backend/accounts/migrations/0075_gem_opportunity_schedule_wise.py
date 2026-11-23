from django.db import migrations, models


class AddFieldIfMissing(migrations.AddField):
    """Allow a repaired database to apply this migration normally later."""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        field = model._meta.get_field(self.name)
        with schema_editor.connection.cursor() as cursor:
            columns = schema_editor.connection.introspection.get_table_description(cursor, model._meta.db_table)
        if field.column not in {column.name for column in columns}:
            super().database_forwards(app_label, schema_editor, from_state, to_state)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0074_gem_representations"),
    ]

    operations = [
        AddFieldIfMissing(
            model_name="gembidopportunity",
            name="schedule_wise",
            field=models.BooleanField(default=False),
        ),
    ]
