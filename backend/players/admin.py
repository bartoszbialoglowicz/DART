from django.contrib import admin

from .models import Player

from tournaments.models import Tournament
from tournaments.models import MatchStatistic

admin.site.register(Player)
admin.site.register(MatchStatistic)
admin.site.register(Tournament)