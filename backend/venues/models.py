from django.conf import settings
from django.db import models


class Venue(models.Model):
    owner       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='venues',
    )
    name        = models.CharField(max_length=200)
    address     = models.CharField(max_length=300, blank=True)
    board_count = models.PositiveIntegerField(default=1)

    # Default match format applied as a suggestion in tournament/league creators.
    default_sets      = models.PositiveIntegerField(default=1)
    default_legs      = models.PositiveIntegerField(default=5)
    max_darts_per_leg = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Max darts per player per leg (null = unlimited). Leg decided by bull when exceeded.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
