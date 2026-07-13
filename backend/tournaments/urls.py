from rest_framework.routers import DefaultRouter
from .views import TournamentViewSet, TournamentCycleViewSet

router = DefaultRouter()
router.register('tournaments', TournamentViewSet, basename='tournament')
router.register('tournament-cycles', TournamentCycleViewSet, basename='tournament-cycle')

urlpatterns = router.urls
