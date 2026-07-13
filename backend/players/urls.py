from rest_framework.routers import DefaultRouter
from .views import (
    PlayerViewSet, TrainingSessionViewSet, HighscoreSessionViewSet,
    SectorPracticeSessionViewSet, PendingMatchResultViewSet,
)

router = DefaultRouter()
router.register('players',         PlayerViewSet,                 basename='player')
router.register('training',        TrainingSessionViewSet,        basename='training')
router.register('highscores',      HighscoreSessionViewSet,       basename='highscore')
router.register('sector-practice', SectorPracticeSessionViewSet,  basename='sector-practice')
router.register('pending-results', PendingMatchResultViewSet,     basename='pending-result')

urlpatterns = router.urls
