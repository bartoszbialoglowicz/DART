from django.db import models


class Player(models.Model):
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100)
    average    = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    photo      = models.ImageField(upload_to='players/photos/',      blank=True, null=True)
    winner_img = models.ImageField(upload_to='players/winner_imgs/', blank=True, null=True)
    cpu        = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self) -> str:
        return f'{self.first_name} {self.last_name}'
