from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve as serve_static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('players.urls')),
    path('api/v1/', include('tournaments.urls')),
    path('api/v1/', include('accounts.urls')),
    path('api/v1/', include('leagues.urls')),
    path('api/v1/', include('venues.urls')),
    # django.conf.urls.static.static() only wires this up when DEBUG=True;
    # the container always runs with DEBUG=False, so serve media explicitly
    # (low-traffic self-hosted app — no separate object storage/CDN yet).
    re_path(r'^media/(?P<path>.*)$', serve_static, {'document_root': settings.MEDIA_ROOT}),
]
