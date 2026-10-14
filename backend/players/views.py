from django.db.models import Avg, Count, Max, Sum
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, permissions, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response

from . import linking
from .models import Player, PlayerContact, TrainingSession, HighscoreSession, SectorPracticeSession, PendingMatchResult
from .serializers import (
    PlayerSerializer, TrainingSessionSerializer, HighscoreSessionSerializer,
    SectorPracticeSessionSerializer, PendingMatchResultSerializer,
)


class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ['first_name', 'last_name']
    ordering_fields  = ['last_name', 'average', 'created_at']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy',
                           'link_code', 'linked', 'my_guests', 'link', 'unlink',
                           'contacts', 'remove_contact', 'organizers', 'remove_organizer'):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        user = self.request.user
        if self.action in ('update', 'partial_update', 'destroy'):
            return Player.objects.filter(owner=user)
        # Own bots and account-less players, own profile, and registered
        # players who gave this user their code — never anyone else.
        return linking.visible_players(user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(
        detail=False,
        methods=['post'],
        url_path='setup-profile',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def setup_profile(self, request):
        if hasattr(request.user, 'player_profile'):
            return Response({'error': 'Profil gracza już istnieje.'}, status=400)
        serializer = PlayerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        player = serializer.save(user=request.user, owner=request.user, cpu=False)
        return Response(PlayerSerializer(player).data, status=201)

    @action(
        detail=False,
        methods=['get'],
        url_path='my-stats',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def my_stats(self, request):
        if not hasattr(request.user, 'player_profile'):
            return Response({'error': 'Brak profilu gracza.'}, status=404)

        player = request.user.player_profile
        # The profile plus every account-less player linked to it.
        from tournaments.models import MatchStatistic
        agg = MatchStatistic.objects.filter(player__in=linking.identity_ids(player)).aggregate(
            matches_played=Count('id'),
            avg_average=Avg('match_average'),
            total_double_attempts=Sum('double_attempts'),
            total_double_hits=Sum('double_hits'),
            avg_darts_per_leg=Avg('darts_per_leg'),
            total_180=Sum('count_180'),
            total_high_checkouts=Sum('high_checkouts'),
            total_short_legs=Sum('short_legs'),
        )

        da = agg['total_double_attempts'] or 0
        dh = agg['total_double_hits'] or 0
        double_accuracy = round(dh / da * 100, 1) if da > 0 else None

        return Response({
            'player': PlayerSerializer(player).data,
            'stats': {
                'matches_played':   agg['matches_played'] or 0,
                'match_average':    round(agg['avg_average'] or 0, 2),
                'double_accuracy':  double_accuracy,
                'darts_per_leg':    round(agg['avg_darts_per_leg'] or 0, 1),
                'count_180':        agg['total_180'] or 0,
                'high_checkouts':   agg['total_high_checkouts'] or 0,
                'short_legs':       agg['total_short_legs'] or 0,
            },
        })


    @action(
        detail=False,
        methods=['get'],
        url_path='my-events',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def my_events(self, request):
        player = getattr(request.user, 'player_profile', None)
        if not player:
            return Response([])

        today = timezone.now().date()
        events = []

        identity = linking.identity_ids(player)

        # ── Mecze ligowe ──────────────────────────────────────────────────────
        from leagues.models import LeagueMatch
        matches = (
            LeagueMatch.objects
            .filter(
                Q(home__player__in=identity) | Q(away__player__in=identity),
                scheduled_at__isnull=False,
                scheduled_at__date__gte=today,
                status='pending',
            )
            .select_related('home', 'away', 'home__league')
            .order_by('scheduled_at')[:30]
        )
        for m in matches:
            is_home = m.home.player_id in identity
            opponent = m.away.display_name if is_home else m.home.display_name
            events.append({
                'type':      'league_match',
                'date':      m.scheduled_at.date().isoformat(),
                'title':     f'vs. {opponent}',
                'subtitle':  m.home.league.name,
                'league_id': m.home.league_id,
                'matchday':  m.matchday,
            })

        # ── Turnieje ──────────────────────────────────────────────────────────
        from tournaments.models import Tournament
        tournaments = (
            Tournament.objects
            .filter(
                entries__player__in=identity,
                start_date__isnull=False,
                start_date__date__gte=today,
            )
            .distinct()
            .order_by('start_date')[:30]
        )
        for t in tournaments:
            events.append({
                'type':          'tournament',
                'date':          t.start_date.date().isoformat(),
                'title':         t.name,
                'subtitle':      'Turniej',
                'tournament_id': t.id,
            })

        events.sort(key=lambda e: e['date'])
        return Response(events[:20])


    # ── Linking account-less players to a profile ─────────────────────────────

    def _link_error(self, exc):
        return Response({'detail': str(exc)}, status=exc.status_code)

    @staticmethod
    def _tournaments_of(players):
        """{player_id: [events]} — tournaments and leagues each player took part in."""
        from leagues.models import LeagueMember
        from tournaments.models import TournamentEntry
        by_player = {}
        entries = (
            TournamentEntry.objects.filter(player__in=players)
            .select_related('tournament').order_by('-tournament__created_at')
        )
        for e in entries:
            by_player.setdefault(e.player_id, []).append({
                'kind':         'tournament',
                'id':           e.tournament_id,
                'name':         e.tournament.name,
                'display_name': e.display_name,
                'date':         (e.tournament.start_date or e.tournament.created_at).date().isoformat(),
            })
        members = LeagueMember.objects.filter(player__in=players).select_related('league').order_by('-league__created_at')
        for m in members:
            by_player.setdefault(m.player_id, []).append({
                'kind':         'league',
                'id':           m.league_id,
                'name':         m.league.name,
                'display_name': m.display_name,
                'date':         m.league.created_at.date().isoformat(),
            })
        return by_player

    @action(
        detail=False,
        methods=['get', 'post', 'delete'],
        url_path='link-code',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def link_code(self, request):
        """The registered player's code for organizers (GET current, POST new, DELETE revoke)."""
        player = getattr(request.user, 'player_profile', None)
        if player is None:
            return Response({'detail': 'Najpierw utwórz profil gracza.'}, status=400)
        if request.method == 'DELETE':
            linking.revoke_code(player)
            return Response(status=204)
        if request.method == 'POST':
            try:
                code = linking.issue_code(player)
            except linking.LinkError as exc:
                return self._link_error(exc)
        else:
            code = linking.active_code(player)
            if code is None:
                return Response({'code': None, 'expires_at': None})
        return Response({'code': linking.format_code(code.code), 'expires_at': code.expires_at})

    @action(
        detail=False,
        methods=['get'],
        url_path='linked',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def linked(self, request):
        """Account-less players organizers have linked to my profile."""
        player = getattr(request.user, 'player_profile', None)
        if player is None:
            return Response([])
        aliases = list(player.merged_aliases.select_related('owner').order_by('id'))
        tournaments = self._tournaments_of(aliases)
        return Response([
            {
                'id':             a.id,
                'name':           a.display_name,
                'owner_username': a.owner.username if a.owner else None,
                'tournaments':    tournaments.get(a.id, []),
            }
            for a in aliases
        ])

    @action(
        detail=False,
        methods=['get'],
        url_path='my-guests',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def my_guests(self, request):
        """My account-less players (słupy) and the tournaments they played."""
        guests = list(
            Player.objects.filter(owner=request.user, user__isnull=True, cpu=False)
            .select_related('merged_into').order_by('first_name', 'last_name')
        )
        tournaments = self._tournaments_of(guests)
        return Response([
            {
                'id':          g.id,
                'name':        g.display_name,
                'linked_to':   g.merged_into.display_name if g.merged_into_id else None,
                'tournaments': tournaments.get(g.id, []),
            }
            for g in guests
        ])

    @action(
        detail=True,
        methods=['post'],
        url_path='link',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def link(self, request, pk=None):
        """Organizer links their słup using the player's code. `dry_run`
        returns whose code it is without linking."""
        slup = get_object_or_404(Player, pk=pk)
        contact_id = request.data.get('contact_id')
        try:
            target = linking.link(
                request.user, slup, request.data.get('code', ''),
                contact_id=int(contact_id) if contact_id else None,
                dry_run=bool(request.data.get('dry_run')),
            )
        except linking.LinkError as exc:
            return self._link_error(exc)
        return Response({'linked_to': target.display_name, 'linked': not request.data.get('dry_run')})

    @action(
        detail=True,
        methods=['post'],
        url_path='unlink',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def unlink(self, request, pk=None):
        slup = get_object_or_404(Player.objects.select_related('merged_into'), pk=pk)
        try:
            linking.unlink(request.user, slup)
        except linking.LinkError as exc:
            return self._link_error(exc)
        return Response(status=204)


    # ── Contacts: registered players an organizer may pick ────────────────────

    @action(
        detail=False,
        methods=['get', 'post'],
        url_path='contacts',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def contacts(self, request):
        """GET: my registered players. POST {code, dry_run}: add one by their code."""
        if request.method == 'POST':
            try:
                target = linking.add_contact(
                    request.user, request.data.get('code', ''), dry_run=bool(request.data.get('dry_run')),
                )
            except linking.LinkError as exc:
                return self._link_error(exc)
            return Response({'id': target.id, 'name': target.display_name, 'added': not request.data.get('dry_run')})
        rows = PlayerContact.objects.filter(owner=request.user).select_related('player')
        return Response([{'id': c.player_id, 'name': c.player.display_name} for c in rows])

    @action(
        detail=False,
        methods=['delete'],
        url_path=r'contacts/(?P<player_id>\d+)',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def remove_contact(self, request, player_id=None):
        PlayerContact.objects.filter(owner=request.user, player_id=player_id).delete()
        return Response(status=204)

    @action(
        detail=False,
        methods=['get'],
        url_path='organizers',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def organizers(self, request):
        """Organizers who may add me to their tournaments and leagues."""
        player = getattr(request.user, 'player_profile', None)
        if player is None:
            return Response([])
        rows = PlayerContact.objects.filter(player=player).select_related('owner').order_by('owner__username')
        return Response([{'id': c.owner_id, 'username': c.owner.username} for c in rows])

    @action(
        detail=False,
        methods=['delete'],
        url_path=r'organizers/(?P<user_id>\d+)',
        authentication_classes=[TokenAuthentication],
        permission_classes=[permissions.IsAuthenticated],
    )
    def remove_organizer(self, request, user_id=None):
        player = getattr(request.user, 'player_profile', None)
        if player is not None:
            PlayerContact.objects.filter(player=player, owner_id=user_id).delete()
        return Response(status=204)


class TrainingSessionViewSet(viewsets.ModelViewSet):
    serializer_class   = TrainingSessionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        if not hasattr(self.request.user, 'player_profile'):
            return TrainingSession.objects.none()
        return TrainingSession.objects.filter(player=self.request.user.player_profile)

    def perform_create(self, serializer):
        serializer.save(player=self.request.user.player_profile)


class HighscoreSessionViewSet(viewsets.ModelViewSet):
    serializer_class   = HighscoreSessionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    http_method_names  = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        if not hasattr(self.request.user, 'player_profile'):
            return HighscoreSession.objects.none()
        return HighscoreSession.objects.filter(player=self.request.user.player_profile)

    def perform_create(self, serializer):
        serializer.save(player=self.request.user.player_profile)


class SectorPracticeSessionViewSet(viewsets.ModelViewSet):
    serializer_class   = SectorPracticeSessionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    http_method_names  = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        if not hasattr(self.request.user, 'player_profile'):
            return SectorPracticeSession.objects.none()
        return SectorPracticeSession.objects.filter(player=self.request.user.player_profile)

    def perform_create(self, serializer):
        serializer.save(player=self.request.user.player_profile)


class PendingMatchResultViewSet(viewsets.GenericViewSet,
                                viewsets.mixins.ListModelMixin,
                                viewsets.mixins.CreateModelMixin,
                                viewsets.mixins.DestroyModelMixin):
    serializer_class       = PendingMatchResultSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get_queryset(self):
        player = getattr(self.request.user, 'player_profile', None)
        if not player:
            return PendingMatchResult.objects.none()
        return PendingMatchResult.objects.filter(for_player=player)

    def perform_create(self, serializer):
        try:
            for_player = Player.objects.get(pk=self.request.data.get('for_player_id'))
        except Player.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'for_player_id': 'Gracz nie istnieje.'})
        serializer.save(for_player=for_player)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        pending = self.get_object()
        player  = getattr(request.user, 'player_profile', None)
        if not player or pending.for_player != player:
            from rest_framework.response import Response
            from rest_framework import status as http_status
            return Response({'detail': 'Brak uprawnień.'}, status=http_status.HTTP_403_FORBIDDEN)

        legs_total = pending.legs_won + pending.legs_lost
        TrainingSession.objects.create(
            player          = player,
            played_at       = pending.played_at,
            average         = pending.average,
            legs            = legs_total,
            double_attempts = pending.double_attempts,
            double_hits     = pending.double_hits,
        )
        pending.delete()
        from rest_framework.response import Response
        return Response(status=204)
