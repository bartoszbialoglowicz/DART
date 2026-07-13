# REFACTOR PLAN — Dart Club App

> Wygenerowano: 2026-06-13  
> Gałąź: feat/checkouts-game  
> Stack: Django 4 + DRF · React 18 + TypeScript + React Query  

---

## 1. Aktualna struktura folderów i niespójności

### Struktura (uproszczona)

```
dart/
├── backend/
│   ├── config/          settings.py, urls.py, wsgi.py
│   ├── accounts/        auth (register, login, logout, me)
│   ├── players/         Player, TrainingSession
│   ├── tournaments/     Tournament, MatchLeg, MatchStatistic
│   ├── leagues/         League, LeagueMember, LeagueMatch
│   └── media/
└── src/
    ├── api/             client.ts + moduły per-feature
    ├── components/
    │   ├── auth/
    │   ├── bracket/
    │   ├── layout/
    │   ├── league/
    │   ├── match/
    │   ├── profile/
    │   ├── solo/
    │   ├── tournament/
    │   └── ui/          ← lowercase, reszta PascalCase
    ├── context/
    │   └── AuthContext.tsx
    ├── hooks/
    ├── pages/
    ├── types/
    └── utils/
```

### Niespójności w nazewnictwie

| Lokalizacja | Problem | Przykład |
|---|---|---|
| `src/pages/` | Mieszanie polskiego i angielskiego | `TurniejePage`, `LigePage`, `GraczePage` vs `SoloPage`, `RankingPage` |
| `src/components/ui/` | Jedyna katalog lowercase w obrębie `components/` | `ui/` vs `Auth/`, `Bracket/` |
| `src/types/tournament.ts` | `playerAvg` w `MatchSlot` vs `average` w `Player` | spójność pola "średnia" |
| `src/hooks/useTraining.ts` | Prosty klucz `KEY = ['training']` zamiast factory pattern | vs `tournamentKeys`, `leagueKeys`, `playerKeys` |
| `backend/config/urls.py` | Wszystkie apki montowane pod tym samym prefiksem bez własnych namespace | `/api/v1/` × 4 apki — ryzyko kolizji nazw tras |

---

## 2. Zduplikowane i prawie-zduplikowane komponenty

### A. Komponenty modali

Wszystkie modale korzystają z `ui/Modal.tsx`, ale implementują własną logikę niezależnie:

| Plik | Rozmiar | Uwagi |
|---|---|---|
| `src/components/ui/Modal.tsx` | ~60 linii | Baza: wrapper z prop `size` (sm/md/lg) |
| `src/components/auth/AuthModal.tsx` | ~80 linii | Logika login/register + state tab |
| `src/components/auth/PlayerSetupModal.tsx` | ~? linii | Setup profilu po rejestracji |
| `src/components/tournament/CreateTournamentModal.tsx` | ~? linii | 2-krokowy wizard |
| `src/components/league/CreateLeagueModal.tsx` | ~? linii | Formularz tworzenia ligi |

**Problem:** Każdy modal powtarza własny schemat: `const [error, setError] = useState<string>('')` + `try/catch` blok + wyświetlanie błędów. Nie ma wspólnego `useFormModal()` hooka.

### B. Formatowanie dat i statusów

Zduplikowane w co najmniej 3 miejscach:

```
src/pages/LigePage.tsx            statusLabel / statusColor (linie 9–19)
src/pages/LeagueDetailPage.tsx    StatusChip / fmtDate (linie 654–662)
src/pages/ProfilePage.tsx         fmtDate (lokalnie)
```

Brak centralnego `src/utils/formatting.ts`.

### C. Obsługa paginacji po stronie klienta

```
src/api/players.ts     → zwraca PaginatedResponse<Player>  (pełny obiekt)
src/api/leagues.ts     → ekstraktuje .results              (tylko lista)
src/api/training.ts    → ekstraktuje .results              (tylko lista)
```

Trzy różne konwencje dla tego samego wzorca. Komponenty muszą obsługiwać dwa kształty odpowiedzi.

### D. Obliczenia statystyk — dwie ścieżki

| Źródło | Gdzie obliczane | Przechowywane |
|---|---|---|
| Turnieje | Backend — `PlayerViewSet.my_stats()` (`players/views.py:39–77`) | `MatchStatistic` (DB) |
| Treningi | Frontend — React Query | `TrainingSession` (DB) |

Brak ujednoliconej warstwy statystyk; jakiekolwiek porównania wymagają łączenia danych z dwóch endpointów.

---

## 3. Powtarzające się wzorce w warstwie API

### Backend

#### Viewsety — wspólne pola

Każdy ViewSet powtarza te same deklaracje bez klasy bazowej:

```python
# tournaments/views.py, leagues/views.py, players/views.py
permission_classes = [IsAuthenticatedOrReadOnly]  # lub własna klasa
queryset = Model.objects.all()
serializer_class = ModelSerializer
```

Brak `BaseModelViewSet` z domyślnymi uprawnieniami i paginacją.

#### Serializery — wzorzec nested names

```python
# leagues/serializers.py:14–24
class LeagueMatchSerializer(serializers.ModelSerializer):
    home_name = serializers.SerializerMethodField()
    away_name = serializers.SerializerMethodField()

    def get_home_name(self, obj): return obj.home.name
    def get_away_name(self, obj): return obj.away.name
```

Ten wzorzec `get_<field>_name` pojawia się w kilku miejscach i mógłby być zastąpiony `SlugRelatedField` lub mixin-em.

#### Obsługa błędów — brak spójnego formatu

Każdy widok zwraca błędy inaczej:

```python
# accounts/views.py
return Response({'error': 'Invalid credentials'}, status=400)

# leagues/views.py
return Response({'detail': 'Already a member'}, status=400)

# tournaments/views.py
return Response({'message': 'Not found'}, status=404)
```

Trzy różne klucze: `error`, `detail`, `message`. Frontend parsuje je wszystkie osobno.

#### Paginacja — globalna, ale niestosowana jednolicie

`settings.py` definiuje globalną paginację:
```python
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}
```

Ale niektóre endpointy (np. `standings`, `schedule`) zwracają plain listy bez paginacji,
a frontend oczekuje to `PaginatedResponse`, to zwykłej tablicy.

#### Logika biznesowa w views.py zamiast serwisów

`leagues/views.py` (278 linii) zawiera:
- `_round_robin()` — generowanie harmonogramu (linie 17–43)
- `_compute_standings()` — obliczanie tabeli (linie 46–95)
- 9 custom actions na `LeagueViewSet`

To są serwisy ukryte jako funkcje modułowe. Brak warstwy `services/`.

#### Brackets — dwa źródła prawdy

```
Tournament.bracket  (JSONField)   ← bez nóg
MatchLeg           (osobna tabela) ← nogi
```

Przy każdym odczycie: `merge_legs_into_bracket()`.  
Przy każdym zapisie: `strip_legs_from_bracket()` + zapis do `MatchLeg`.  
Ryzyko desynchronizacji przy błędach częściowego zapisu.

### Frontend

#### Hooks — niekonsekwentna struktura kluczy cache

```typescript
// useTournaments.ts — factory pattern (właściwe)
export const tournamentKeys = {
  all: ['tournaments'] as const,
  lists: () => [...tournamentKeys.all, 'list'] as const,
  detail: (id: number) => [...tournamentKeys.all, 'detail', id] as const,
}

// useTraining.ts — prosty klucz (niespójne)
const KEY = ['training'];
```

#### API calls — obsługa loading/error niekonsekwentna

```typescript
// TournamentPage.tsx:21
if (isLoading) return <div>Ładowanie...</div>

// inne komponenty
if (isPending) return <div>Ładowanie...</div>
```

`isLoading` i `isPending` mają różną semantykę w React Query v5 — `isPending` jest poprawne.

---

## 4. Propozycja docelowej struktury i konwencji

### 4.1 Frontend — nowa struktura `src/`

```
src/
├── api/
│   ├── client.ts          bez zmian — dobry wzorzec
│   ├── auth.ts
│   ├── players.ts
│   ├── tournaments.ts
│   ├── leagues.ts
│   └── training.ts
├── components/
│   ├── ui/                → przemianować na UI/ (PascalCase) LUB zostawić lowercase jako wyjątek — zadecydować raz
│   │   ├── Modal.tsx
│   │   ├── Toggle.tsx
│   │   └── (Button, Badge, Chip — nowe elementy UI)
│   ├── auth/
│   ├── bracket/
│   │   ├── LiveMatchScreen/   ← rozdzielić na podkatalog
│   │   │   ├── index.tsx      (koordynator, max 150 linii)
│   │   │   ├── LegEntry.tsx   (wpisywanie nóg)
│   │   │   ├── ScoreBoard.tsx (wynik meczu)
│   │   │   └── ActionBar.tsx  (przyciski akcji)
│   │   ├── KnockoutBracket.tsx
│   │   ├── GroupsBracket.tsx
│   │   ├── MatchCard.tsx
│   │   └── MatchActionMenu.tsx
│   ├── league/
│   │   ├── CreateLeagueModal.tsx
│   │   ├── StandingsTab.tsx   ← wydzielić z LeagueDetailPage
│   │   ├── ScheduleTab.tsx    ← wydzielić z LeagueDetailPage
│   │   └── RosterTab.tsx      ← wydzielić z LeagueDetailPage
│   ├── tournament/
│   ├── profile/
│   ├── layout/
│   └── solo/
├── context/
│   └── AuthContext.tsx
├── hooks/
│   ├── useTournaments.ts
│   ├── useLeagues.ts
│   ├── usePlayers.ts
│   ├── useTraining.ts    ← przepisać na factory pattern
│   └── useFormModal.ts   ← NOWY: wspólna logika formularzy w modalach
├── pages/
│   ├── TournamentsPage.tsx    ← był: TurniejePage.tsx
│   ├── TournamentPage.tsx
│   ├── LeaguesPage.tsx        ← był: LigePage.tsx
│   ├── LeagueDetailPage.tsx   ← split: logika tabów do components/league/
│   ├── PlayersPage.tsx        ← był: GraczePage.tsx (teraz puste)
│   ├── ProfilePage.tsx
│   ├── SoloPage.tsx
│   ├── RankingPage.tsx
│   └── LiveMatchPage.tsx
├── types/
│   ├── player.ts
│   ├── tournament.ts
│   ├── league.ts
│   ├── bracket.ts
│   └── common.ts         ← NOWY: PaginatedResponse<T>, ApiError, shared enums
└── utils/
    ├── bracket.ts
    ├── simulate.ts
    ├── statistics.ts
    ├── formatting.ts     ← NOWY: fmtDate, fmtAverage, statusLabel itp.
    └── colors.ts         ← NOWY: statusColor, matchStatusColor itp.
```

**Uzasadnienie:**
- Wszystkie strony po angielsku — spójność dla nowych developerów i narzędzi (grep, autoimport)
- `LiveMatchScreen` rozbity na podkatalog — komponent 30 KB jest niemożliwy do testowania
- `LeagueDetailPage` traci zakładki inline — każda zakładka to osobny komponent w `components/league/`
- `useFormModal` eliminuje copy-paste error/loading state w każdym modalu
- `utils/formatting.ts` + `utils/colors.ts` eliminują duplikaty z 3 stron

### 4.2 Backend — nowa struktura

```
backend/
├── config/
│   ├── settings.py
│   ├── urls.py            ← dodać namespace per-app
│   └── wsgi.py
├── core/                  ← NOWY: wspólne elementy
│   ├── permissions.py     (IsOwnerOrReadOnly i inne — teraz w tournaments/views.py)
│   ├── serializers.py     (BaseModelSerializer z get_<x>_name mixin)
│   └── pagination.py      (jeśli custom pagination będzie potrzebna)
├── accounts/
├── players/
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── services.py        ← NOWY: my_stats() logika wydzielona z views
│   └── urls.py
├── tournaments/
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── services.py        ← NOWY: strip/merge legs, perform_update logika
│   └── urls.py
└── leagues/
    ├── models.py
    ├── serializers.py
    ├── views.py
    ├── services.py        ← NOWY: _round_robin, _compute_standings
    └── urls.py
```

**Uzasadnienie:**
- `core/` eliminuje duplikaty klasy uprawień i mixin-ów serializerów
- `services.py` w każdej apce oddziela logikę biznesową od warstwy HTTP — viewsety robią tylko routing i uwierzytelnianie, serwisy robią pracę
- Logika w serwisach jest testowalna jednostkowo bez klienta HTTP

### 4.3 Konwencje API — ujednolicenie

#### Format błędów — jeden klucz

```python
# Zawsze zwracamy: {"detail": "...", "code": "optional_machine_readable"}
# Nigdy: {"error": ...} ani {"message": ...}
```

Wymaga małego custom exception handlera w `config/`:

```python
# config/exceptions.py
from rest_framework.views import exception_handler

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and 'detail' not in response.data:
        response.data = {'detail': str(response.data)}
    return response
```

#### Paginacja — jeden kształt odpowiedzi

Wszystkie endpointy list ZAWSZE zwracają:

```json
{ "count": 42, "next": null, "previous": null, "results": [...] }
```

Frontend zawsze czyta `.results`. Obecnie `leaguesApi` i `trainingApi` już to robią — `playersApi` powinno być naprawione.

#### URL namespace

```python
# config/urls.py
urlpatterns = [
    path('api/v1/', include(('players.urls', 'players'))),
    path('api/v1/', include(('tournaments.urls', 'tournaments'))),
    path('api/v1/', include(('leagues.urls', 'leagues'))),
    path('api/v1/', include(('accounts.urls', 'accounts'))),
]
```

### 4.4 Priorytety refaktoringu

| # | Zadanie | Ryzyko | Szacowany nakład |
|---|---|---|---|
| 1 | `LiveMatchScreen.tsx` → podkatalog + split | NISKIE — czysto komponentowe | 3–4h |
| 2 | `LeagueDetailPage.tsx` → 3 tab-komponenty | NISKIE | 2h |
| 3 | `utils/formatting.ts` + dedupl. fmtDate/statusColor | NISKIE | 1h |
| 4 | `useTraining` → factory query keys | NISKIE | 30min |
| 5 | Rename stron z polskich na angielskie (+ trasy w App.tsx) | ŚREDNIE — dotyka routingu | 1h |
| 6 | Backend: wydzielić `leagues/services.py` | ŚREDNIE | 2h |
| 7 | Backend: `core/permissions.py` | NISKIE | 30min |
| 8 | Ujednolicić format błędów (custom exception handler) | NISKIE — izolowane | 1h |
| 9 | Naprawić kształt paginacji w `playersApi` | NISKIE | 30min |
| 10 | Backend: `tournaments/services.py` (bracket/legs) | WYSOKIE — logika złożona | 3–4h |

> **Strategia:** Zaczynać od zadań 1–5 (frontend, niskie ryzyko). Każde zadanie to osobny commit lub PR. Zadanie 10 (przebudowa brackets/legs) wymaga osobnej analizy — rozważyć migrację do denormalizacji (nogi wewnątrz JSONField) jako osobny ticket.

---

## 5. Decyzje, które wymagają potwierdzenia

1. **Nazwy stron** — czy zmieniamy routing `/turnieje` → `/tournaments`, `/ligi` → `/leagues` w URL? Czy zostawiamy polskie URL-e jako "user-facing" (SEO/UX)?
2. **Bracket + nogi** — czy denormalizujemy nogi z powrotem do JSONField (prostsze, jedne źródło prawdy), czy zostawiamy osobną tabelę (łatwiejsze zapytania per-mecz)?
3. **`ui/` katalog** — lowercase zostawiamy jako "prymitywy UI" (konwencja jak w shadcn/ui), czy ujednolicamy do `UI/` (PascalCase)?
