import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    # UPS can be installed without running unrelated pending data cleanups.
    dependencies = [('accounts', '0070_componentoption')]

    operations = [
        migrations.CreateModel(
            name='UpsBid',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bid_no', models.CharField(db_index=True, max_length=150)),
                ('dept_name', models.CharField(max_length=255)),
                ('organization', models.CharField(max_length=255)),
                ('address', models.TextField()),
                ('pincode', models.CharField(max_length=6)),
                ('qty', models.PositiveIntegerField(default=1)),
                ('atc', models.TextField(blank=True, default='')),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('ups_type', models.CharField(max_length=40)),
                ('specs', models.JSONField(default=dict)),
                ('upload_document', models.FileField(blank=True, upload_to='ups/bid_documents/')),
                ('atc_special_document', models.FileField(blank=True, upload_to='ups/special_documents/')),
                ('selected_general_docs', models.JSONField(default=list)),
                ('status', models.CharField(db_index=True, default='draft', max_length=30)),
                ('analyser_username', models.CharField(blank=True, default='', max_length=150)),
                ('analyser_note', models.TextField(blank=True, default='')),
                ('admin_username', models.CharField(blank=True, default='', max_length=150)),
                ('admin_note', models.TextField(blank=True, default='')),
                ('model_number', models.CharField(blank=True, default='', max_length=150)),
                ('unit_price', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('local_content', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'ups_bid_details',
                'ordering': ['-updated_at', '-pk'],
            },
        ),
        migrations.AddField(
            model_name='upsbid',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ups_bids', to='accounts.user'),
        ),
    ]
