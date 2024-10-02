from django.db import models

# Create your models here.
class Destination(models.Model):
    name = models.CharField(unique=True, max_length=100, null=False, blank=False)
    description = models.TextField(max_length=2000, null=False, blank=False)