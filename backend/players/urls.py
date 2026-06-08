from rest_framework.routers import DefaultRouter
from .views import PlayerViewSet, TrainingSessionViewSet

router = DefaultRouter()
router.register('players',  PlayerViewSet,          basename='player')
router.register('training', TrainingSessionViewSet, basename='training')

urlpatterns = router.urls
