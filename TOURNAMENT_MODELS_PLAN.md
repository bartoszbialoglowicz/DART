# Turnieje: z JSON-a na modele

> Utworzono: 2026-10-14 · gałąź: `feat/tournament-models` (od `master`)
> Cel: `Tournament.bracket` (JSON) przestaje być źródłem prawdy. Turniej, uczestnicy, fazy, grupy, rundy i mecze żyją w tabelach.
> Odblokowuje to: (1) łączenie kont graczy ze słupami i statystyki z historii, (2) własne układy drabinki, elastyczne grupy i konfigurowalną liczbę awansujących.

---

## 1. Stan obecny (punkt wyjścia)

**Backend**

- `Tournament.bracket` przechowuje cały turniej: sloty graczy (`playerId`, `playerName`, `playerAvg`, `isCpu`, `cpuSigma`), mecze, wyniki, konfigurację faz.
- Zapis to `PATCH` całego JSON-a. Ochronę przed nadpisaniem dają łatki porównujące stary i nowy JSON: `find_locked_result_changes`, `find_bot_simulation_lock_violations`.
- `MatchLeg` trzyma legi meczu pod kluczem `match_id: str`.
- `MatchStatistic` identyfikuje gracza przez `player` (FK, nullable) **albo** `player_name`.
- `TournamentParticipant` jest przebudowywany z JSON-a przy każdym zapisie (`sync_participants`).
- `_placement_tiers` i `_match_win_counts` (punkty cyklu) parsują JSON. Miejsce w turnieju liczą z numeru rundy od końca.

**Frontend**

- Drabinkę generuje klient: `src/utils/bracket.ts` (`generateBracket`, `redrawBracket`, `generatePlayoffFromGroups`).
- Awans też liczy klient (`applyResult*`). ID meczu jest parsowane (`r{runda}-m{mecz}`).
- Placeholder w kreatorze to gracz z **ujemnym** `id`, który nigdy nie trafia do tabeli `Player`.

**Dane produkcyjne (zrzut `backend_data_dump.json`)**

- 66 turniejów (29 SKO, 37 grupowych; tylko 7 grupowych ma wygenerowany playoff).
- 1977 meczów, z czego 537 z wynikiem.
- 991 `MatchStatistic`, w tym 125 bez FK gracza.
- 97 `MatchLeg`.
- Starsze wersje JSON-a:
  - 3 turnieje bez `name` / `playerCount`;
  - legi osadzone w JSON-ie (`match.legs` / `match.currentLeg`) w 16–19 meczach;
  - 4 grupy bez `matches`;
  - 3 drabinki SKO z 0 rund.
- Konwencja wyniku: `topSetsWon` / `bottomSetsWon` to **sety** (przy `sets == 1` wynosi 1/0). `displayScore` to **legi**, gdy `sets == 1`, a sety w pozostałych przypadkach.

**Znane błędy, które przebudowa naprawia przy okazji**

- **Wolne losy w SKO.** Mecz z pustym slotem nigdy się nie kończy, więc turniej z liczbą graczy różną od potęgi dwójki zostaje „aktywny” na zawsze. Losowanie może też zestawić dwa wolne losy ze sobą.
- **Tabela grupy liczy legi z `topSetsWon`.** Przy `sets == 1` to zawsze 1/0, więc „bilans legów” jest w rzeczywistości bilansem meczów.
- **Dwóch placeholderów o tej samej nazwie** zlewa się w jedną osobę w punktacji cyklu (`_player_key`).
- **6 testów w `LegDetailsStorageTests`** pada od czasu wprowadzenia `MatchLeg` (oczekują `legs` w JSON-ie).

---

## 2. Docelowy model danych

```
Tournament ─┬─ TournamentEntry        (uczestnik: zawsze Player + migawka nazwy/średniej)
            ├─ Stage                  (faza: groups | knockout; kolejność; format; config)
            │   ├─ Group ── GroupMember (entry, position)
            │   └─ Round              (runda drabinki: code, label, data, format, tier)
            └─ Match                  (stage, round?, group?, code, top/bottom entry,
                │                      top/bottom source, wynik, status, legi)
                └─ MatchStatistic     (match FK + entry FK)
```

### `Tournament` (istniejący, rozszerzony)

| pole | uwagi |
|---|---|
| `match_format` JSON | domyślny format `{sets, legs, max_darts_per_leg?}` |
| `board_count` int? | z obiektu (venue), dotąd `bracket.board_count` |
| `format` | zostaje do wyświetlania (`knockout` / `groups`); później dojdzie `custom` |
| `is_active` | liczone przez serwis po każdej zmianie wyniku |
| `bracket` | → `legacy_bracket` (nullable, tylko do odczytu) na jedno wydanie, potem usunięte |

### `TournamentEntry` (zastępuje `TournamentParticipant`)

| pole | uwagi |
|---|---|
| `tournament` FK CASCADE, `related_name='entries'` | |
| `player` FK `Player` SET_NULL | **zawsze ustawiony przy tworzeniu**; null tylko po skasowaniu gracza |
| `display_name` | migawka nazwy z dnia turnieju |
| `average_snapshot` Decimal | dotychczasowe `playerAvg` (potrzebne do symulacji i `cpuSigma`) |
| `is_cpu` bool | migawka |
| `seed` int? | rozstawienie (przyszły kreator) |
| unikalność | `(tournament, player)` gdy `player` nie jest null |

**Placeholder z kreatora staje się słupem:** `Player(owner=organizator, user=None, cpu=False)`. To ta sama konstrukcja co gracz dodany w „Gracze”, więc łączenie z kontem (etap 7) działa dla obu przypadków jednakowo. Ujemne ID znikają.

### `Stage`

| pole | uwagi |
|---|---|
| `tournament` FK, `order` | unikalne razem |
| `kind` | `groups` / `knockout` |
| `label` | „Faza grupowa”, „Playoff” |
| `match_format` JSON? | null = format turnieju |
| `date` date? | data fazy grupowej (dotąd `phaseConfigs.groups.date`) |
| `config` JSON | `groups`: `{group_size, advance_per_group}`; `knockout`: `{size, third_place: false}`. Tu dojdą przyszłe opcje kreatora (najlepsze 3. miejsca, play-in…) |

### `Group` / `GroupMember`

- `Group`: `stage`, `order`, `label` (A, B…), `board?`.
- `GroupMember`: `group`, `entry`, `position`. Unikalne: `(group, entry)` i `(group, position)`.

### `Round`

| pole | uwagi |
|---|---|
| `stage`, `order` | |
| `code` | klucz dotychczasowych `phaseConfigs`: `round-0` (SKO), `r0` (playoff) |
| `label`, `date?`, `match_format?` | |
| `tier` | `final` / `semifinal` / `quarterfinal` / `other`. Zapisywany przy generowaniu, więc punktacja cyklu nie zgaduje miejsca z numeru rundy (a własny układ drabinki może je ustawić jawnie) |

### `Match` (wchłania `MatchLeg`)

| pole | uwagi |
|---|---|
| `tournament` FK (denormalizacja do zapytań), `stage` FK, `round` FK?, `group` FK? | |
| `code` | publiczne ID w obrębie turnieju (`r0-m3`, `group-1-m4`); unikalne `(tournament, code)`. **Zachowane z JSON-a**, więc URL-e `/turnieje/:id/mecz/:code` i statystyki dalej działają |
| `order` | pozycja w rundzie / kolejność w grupie |
| `top_entry`, `bottom_entry` FK `TournamentEntry`? | |
| `top_source`, `bottom_source` JSON? | skąd przychodzi gracz: `{"kind":"winner","match":"r0-m1"}`, `{"kind":"loser","match":…}`, `{"kind":"group","group":"A","place":1}`. null = slot obsadzony wprost przy losowaniu albo wolny los |
| `status` | `pending` / `live` / `finished` / `bye` |
| `winner` | `top` / `bottom` / `''` |
| `top_score`, `bottom_score` int? | wynik „nagłówkowy”: legi przy `sets == 1`, sety w pozostałych przypadkach (konwencja `displayScore`) |
| `legs` JSON, `current_leg` JSON? | dotychczasowy `MatchLeg` |
| `finished_at` | |

Ustalony format meczu to `round.match_format`, a gdy go brak: `stage.match_format`, a potem `tournament.match_format`. Liczy to jedna funkcja w serwisie i zwraca ją API. Frontend przestaje parsować `code`.

### `MatchStatistic` (przejściowo rozszerzony)

> Stan po etapie 6: `match_code` i `player_name` **zostają** jako migawka (kształt API `match_id` / `player_name` i 6 starych wierszy z `match = NULL` z turniejów #18–20). Usunięcie ich wymaga decyzji, co zrobić z tymi 6 wierszami.

- Dochodzą `match` FK i `entry` FK.
- `player` FK zostaje jako denormalizacja (`my_stats` agreguje po nim; trzymane zgodnie z `entry.player`).
- Po migracji usuwamy `match_id: str` i `player_name`, a unikalność to `(match, entry)`.

---

## 3. Logika domenowa: `tournaments/services/`

Całość przechodzi z `src/utils/bracket.ts` i z `models.py` do czystych funkcji Pythona pokrytych testami:

| moduł | odpowiedzialność |
|---|---|
| `generation.py` | `create_tournament(config)`: wpisy (słupy dla placeholderów), losowanie, grupy z harmonogramem `GROUP_MATCH_ORDER`, przydział tarcz, drabinka SKO, **struktura playoffu tworzona od razu** ze źródłami `group/place` (rozstawienie krzyżowe A1–ostatnia2 jak dziś); `redraw(tournament)` |
| `results.py` | `record_result(match, top_score, bottom_score, legs=None, live=False)`: walidacja wyniku względem formatu, blokada (`select_for_update`), idempotentne ponowienie, blokada symulacji bot–bot, czyszczenie `current_leg`, propagacja zwycięzcy/przegranego do meczów ze źródłem `winner`/`loser`, rozstrzyganie wolnych losów, przeliczenie `is_active` |
| `standings.py` | tabela grupy (punkty, bilans **legów**, legi zdobyte), `advance_groups(stage)`: obsadza sloty ze źródłem `group/place` |
| `placement.py` | miejsca w turnieju (z `Round.tier`) i liczba wygranych dla punktacji cyklu |
| `bracket_view.py` | składa kompatybilny JSON `bracket` (dotychczasowy kształt `BracketData`) z modeli, na czas przejścia frontendu |

**Wolne losy:**

- Losowanie rozkłada wolne losy tak, żeby żaden mecz 1. rundy nie miał dwóch (przy `size = nextPow2(n)` zawsze jest ich mniej niż graczy).
- Mecz z jednym graczem i drugą stroną bez źródła dostaje `status=bye`, a gracz przechodzi dalej automatycznie.
- Przypadek defensywny (np. dane historyczne): mecz pusty–pusty to `bye` bez zwycięzcy, a zależna strona jest traktowana jak wolny los.

---

## 4. API

### Odczyt

- `GET /tournaments/` dostaje lekki serializer listy (`player_count`, bez `bracket`). Dziś lista ciągnie pełne drabinki wszystkich turniejów.
- `GET /tournaments/{id}/` zwraca `bracket` w dotychczasowym kształcie, składany z modeli. Legi są wpięte bezpośrednio w mecze, a `match_legs` jest puste. Każdy mecz dostaje dodatkowo `status` i `matchFormat`, każdy slot `entryId`, a każda grupa `standings` (tabela liczona na serwerze, ta sama, na podstawie której działa awans).
- Docelowo (etap 8) dojdzie znormalizowany `GET /tournaments/{id}/structure/` (fazy → grupy/rundy → mecze) dla nowego kreatora i drabinki.

### Zapis: komendy zamiast `PATCH bracket`

| endpoint | zastępuje |
|---|---|
| `POST /tournaments/` `{name, format, is_private, start_date, match_format, group_size, phase_configs, board_count, entries: [{player_id} \| {name}]}` | `generateBracket` na kliencie |
| `POST /tournaments/{id}/redraw/` (tylko szkic) | `redrawBracket` + PATCH |
| `POST /tournaments/{id}/confirm-draft/` | bez zmian |
| `POST /tournaments/{id}/matches/{code}/result/` `{top_score, bottom_score, legs?, live?}` | `applyResult*` + PATCH, `find_locked_result_changes`, `find_bot_simulation_lock_violations` |
| `PUT /tournaments/{id}/match-legs/{code}/` | bez zmian w URL; zapisuje do `Match.legs` / `current_leg` |
| `POST /tournaments/{id}/advance-groups/` | `generatePlayoffFromGroups` + PATCH (przycisk „Generuj playoff” zostaje: właściciel zatwierdza tabelę) |
| `GET/PUT /tournaments/{id}/statistics/` | ten sam kształt (`match_id` = `code`, `player_id`, `player_name`); serwer rozwiązuje `match` i `entry` |

- `PATCH /tournaments/{id}/` przyjmuje już tylko metadane (`name`, `is_private`, `start_date`). Pole `bracket` jest odrzucane.
- Wynik z ekranu „na żywo” idzie jedną komendą z `live: true`, która atomowo czyści `current_leg`. Znika kolejność „najpierw zdejmij blokadę, potem zapisz wynik” sterowana z klienta.

### Pozostałe miejsca w backendzie

- Widoczność prywatnych turniejów: `participants__player` → `entries__player`.
- `players.views.my_events`: to samo.
- `compute_cycle_standings`: przepisane na `services/placement.py`. Klucz gracza to `entry.player_id` (a nie nazwa), z zapasowym kluczem `entry.id` dla wpisów, których gracz został skasowany.

---

## 5. Migracja danych (JSON → modele)

Robi to migracja `0014_import_legacy_brackets` (`RunPython`), która woła idempotentny konwerter z `tournaments/legacy_import.py`. Migracje uruchamia `entrypoint.sh` przy starcie kontenera, więc ta migracja **nigdy nie przerywa wdrożenia**: drukuje raport, a dane, których nie umie powiązać, zostawia nietknięte.

1. **Wpisy.** Dla każdego unikalnego slotu z graczem:
   - `playerId > 0` i `Player` istnieje → ten gracz;
   - ujemne / nieistniejące ID → nowy słup (`owner = tournament.owner`, imię i nazwisko z `playerName`);
   - jeden słup na unikalną nazwę **w obrębie turnieju**.
   - Migawki brane z pierwszego wystąpienia slotu.
2. **Fazy, grupy i rundy** zgodnie z formatem. `phaseConfigs` trafia do `Round.date` / `match_format` i `Stage.date`.
3. **Mecze z zachowaniem `id` → `code`.**
   - Sloty kopiujemy wprost (awans jest już naniesiony w JSON-ie).
   - Źródła (`winner` dla rund > 0, `group/place` dla playoffu) odtwarzamy wzorem z generatora.
   - Turnieje grupowe bez playoffu dostają pustą strukturę playoffu.
4. **Wyniki.** `top_score` / `bottom_score` parsowane z `displayScore`, `winner` z `result.winner`, status `finished`.
5. **Legi.** `MatchLeg` po `code` → `Match.legs` / `current_leg`. Legi osadzone w starym JSON-ie są brane, gdy brak `MatchLeg`.
6. **Statystyki.** `MatchStatistic.match` po `code`. `entry` po `player`, a gdy brak: po `display_name` w obrębie turnieju.
7. **Przeliczenie.** Pass wolnych losów i `is_active` dla turniejów aktywnych.
8. **Raport.** Statystyki bez dopasowanego meczu lub wpisu nie są kasowane. Zostają z `match = NULL` i trafiają do raportu drukowanego przez migrację.

**Weryfikacja przed produkcją** (procedura powtarzalna):

1. Osobna baza `dart_migcheck` (`createdb`).
2. `migrate`, cofnięcie do `tournaments 0013`, `loaddata` zrzutu (z `match_id` → `match_code` w `matchstatistic`), `migrate tournaments`.
3. `manage.py verify_brackets` porównuje JSON z drabinką zbudowaną z modeli.

**Wynik na zrzucie z 2026-07-23 (wykonane 2026-10-14):**

- 66 turniejów, 2411 meczów, 1384 uczestników, 6 nowych słupów z placeholderów.
- 985 z 991 statystyk powiązanych. 6 osieroconych (turnieje #18–20, drabinki bez rund z odwołaniami do nieistniejących meczów) zostaje z `match = NULL`.
- Ostrzeżenia: turniej #15 ma 4 grupy bez meczów; turnieje #18–20 to drabinki bez rund.
- `verify_brackets`: zero nieoczekiwanych różnic. Jedyna zmiana to turniej #16 („Legenda cup”): 6 wolnych losów rozstrzygniętych, a gracz awansuje do finału, w którym wcześniej stał pusty slot.
- `is_active` bez zmian we wszystkich 66 turniejach.
- Punktacja cyklu przed i po: zgodna.

**Wynik na świeżej kopii produkcji (`pg_dump` z 2026-10-14 19:03, `~/backups/dart/`):**

- 105 turniejów, 4734 mecze, 2629 uczestników, 6 nowych słupów.
- 3245 z 3251 statystyk powiązanych; 6 osieroconych to te same co wyżej (#18–20).
- `verify_brackets`: zero nieoczekiwanych różnic; `is_active` identyczne dla wszystkich 105 turniejów; oba cykle mają zgodną punktację.
- Zamierzone różnice (wolne losy) w 3 turniejach:
  - #16 „Legenda cup” (opisany wyżej);
  - #106 „Test”: 1 wolny los;
  - #84 „200826v2”: 33 graczy w drabince na 64, nierozegrany. Stare losowanie zestawiło 15 par pusty–pusty, więc jeden gracz (Paweł Grych) przechodzi przez wolne losy aż do finału bez meczu. To poprawne według reguł drabinki, ale wynika z błędu starego losowania. Jeśli turniej jest szkicem, „Losuj ponownie” po wdrożeniu rozłoży wolne losy poprawnie.

---

## 6. Frontend

| plik | zmiana |
|---|---|
| `api/tournaments.ts`, `hooks/useTournaments.ts` | komendy (`create(config)`, `redraw`, `recordResult`, `advanceGroups`); usunięte `update(bracket)`, `stripLegs` / `mergeLegs` |
| `pages/TournamentSetupPage.tsx` | wysyła konfigurację i listę wpisów (`{player_id}` / `{name}`) zamiast wygenerowanej drabinki |
| `pages/TournamentPage.tsx` | handlery wołają komendy; znika lokalna kopia drabinki i sztuczki z `isMutating`; format meczu bierzemy z `match.matchFormat` |
| `pages/LiveMatchPage.tsx` | `recordResult(..., live: true)` jedną komendą |
| `pages/TournamentsPage.tsx` | `t.player_count` zamiast `t.bracket.playerCount` |
| `utils/bracket.ts` | zostaje tylko to, czego potrzebuje UI (`roundLabel`, `nextPowerOf2` dla podglądu faz w kreatorze, `computeGroupStandings` do czasu aż API zwróci tabele); generatory i `apply*` usunięte |
| `types/bracket.ts` | `BracketMatch` + `status`, `matchFormat`; `MatchSlot` + `entryId` |

Komponenty prezentacji (`KnockoutBracket`, `GroupsBracket`, `MatchCard`, `LiveMatchScreen`, `TournamentStats`) nie zmieniają się w tym kroku, bo dostają ten sam kształt danych.

---

## 7. Etapy i kolejność

Każdy etap kończy się zielonymi testami i działającą aplikacją.

| # | etap | zakres | stan |
|---|---|---|---|
| 0 | Plan | ten dokument; baseline testów (94 testy, 6 znanych błędów) | ✅ |
| 1 | Modele | `TournamentEntry`, `Stage`, `Group`, `GroupMember`, `Round`, `Match`; nowe pola `Tournament` i `MatchStatistic` (`match_id` → `match_code`, bo nazwę zajmuje FK); migracje 0012–0013 | ✅ |
| 2 | Serwisy | `generation`, `progress`, `results`, `standings`, `placement`, `bracket_view` + 36 testów w `test_services.py` (port reguł z `bracket.ts` 1:1, poprawki wolnych losów i bilansu legów) | ✅ |
| 3 | Migracja danych | `legacy_import.py` + migracja 0014 + komenda `verify_brackets` + 2 testy; zweryfikowane na zrzucie (§5) | ✅ |
| 4 | API | komendy, kompatybilny `bracket` w odczycie, lekka lista, widoczność / `my_events` / cykle (`services/cycles.py`) na modelach; `tests.py` przepisane (132 testy backendu zielone, w tym 6 wcześniej czerwonych); punktacja cyklu ze zrzutu zgodna ze starą | ✅ |
| 5 | Frontend | przełączenie na komendy (tabela w §6), tabela grup z serwera (`group.standings`); `npm run build` OK, `lint:ui` 0 uwag, ESLint bez nowych błędów. **Nie przeklikane w przeglądarce** — patrz §9 | ✅ |
| 6 | Sprzątanie | migracja 0015: `bracket` → `legacy_bracket` (nullable, nieczytany, do usunięcia w kolejnym wydaniu); usunięte `MatchLeg`, `TournamentParticipant`, `sync_participants`, helpery JSON, stara punktacja cykli, komenda `verify_brackets` i testy importu; unikalność statystyk to `(match, entry)`. Zweryfikowane na kopii produkcji: 71/71 publicznych drabinek identycznych z produkcją. Commit `7a25aa5`; **wdrożone 2026-10-14 ok. 22:20** (kopia: `backup_dart_2026-10-14_2219_pre-stage6.dump`), po wdrożeniu 71/71 drabinek bez zmian | ✅ |
| 6b | Drop `legacy_bracket` | migracja `tournaments/0016`; zweryfikowane na kopii produkcji (71/71 drabinek bez zmian). Stare JSON-y zostają w kopiach `~/backups/dart/backup_dart_2026-10-14_*.dump` (sprawdzone: 105 i 106 turniejów) | ✅ |
| 7 | Konta ↔ słupy | wg §12 i §13: `Player.merged_into` + `PlayerLinkCode` (`players/0011`), `PlayerContact` (`players/0012`), placeholdery lig → słupy (`leagues/0003`); `players/linking.py`; endpointy `link-code`, `linked`, `my-guests`, `contacts`, `organizers`, `{id}/link`, `{id}/unlink`; tożsamość w `my-stats`, `my-events`, widoczności turniejów i lig, uprawnieniach uczestnika ligi, cyklach i kreatorze; UI: Profil → „Kod dla organizatorów”, Hub → „Gracze”, liga → łączenie z kontaktem. 177 testów. Commit `c63058a`; **wdrożone 2026-10-14 ok. 23:03** (kopia: `backup_dart_2026-10-14_2302_pre-stage7.dump`) | ✅ |
| 8 | Kreator / drabinka | `structure` endpoint; `Stage.config` (awansujący z grup, najlepsze 3. miejsca, mecz o 3. miejsce, play-in); ręczne rozstawienie przez edycję `*_source` / `*_entry` w szkicu; walidacja grafu (brak cykli, każdy slot ma dokładnie jedno źródło) | ☐ |

> ✅ **Etapy 1–5 wdrożone na produkcję 2026-10-14 ok. 22:10** (`docker compose up -d --build` z katalogu roboczego `feat/palette-a`: paleta A + refaktor + niezacommitowane zmiany UI). Raport migracji: 106 turniejów, 4741 meczów, 7 nowych słupów, 3245 statystyk powiązanych, 6 osieroconych (#18–20). `verify_brackets` na produkcji: OK. Kopia sprzed wdrożenia: `~/backups/dart/backup_dart_2026-10-14_2209_predeploy.dump`. Commit refaktoru: `aef61b5` na `feat/tournament-models` (od `master`).

> ⚠️ **Nie wdrażać etapów 1–3 samodzielnie.** Migracja 0014 jest jednorazowa (idempotentna: pomija turnieje, które mają już fazy). Gdyby poszła na produkcję, gdy API wciąż zapisuje JSON, modele by się zdezaktualizowały, a nowe turnieje nie zostałyby zaimportowane.

**Wdrożenie produkcyjne** etapów 1–5 musi pójść **razem** (frontend i backend w jednym deployu): po etapie 4 stary klient nie zapisze już drabinki przez PATCH. Etap 6 idzie osobnym deployem po potwierdzeniu, że dane się zgadzają.

---

## 8. Decyzje podjęte w planie (do zmiany, jeśli coś nie pasuje)

1. **Placeholder = słup** (zwykły `Player` bez konta, właścicielem jest organizator). Nie wprowadzamy osobnego typu „gość”.
2. **`TournamentEntry.player` SET_NULL**, a nie PROTECT. Skasowanie gracza nie blokuje się na historii; nazwa zostaje w migawce.
3. **`code` meczu zostaje publicznym ID** (URL-e, statystyki). PK jest wewnętrzny.
4. **Struktura playoffu powstaje razem z turniejem.** Awans z grup zatwierdza właściciel przyciskiem, co później pozwoli ręcznie rozstrzygać remisy w tabeli.
5. **Symulacja zostaje na kliencie** (animacja „na żywo”, `simulateMatch`). Serwer waliduje wynik względem formatu i liczy awans.
6. **Kompatybilny `bracket` w odczycie** utrzymujemy do etapu 8. Nowy UI drabinki przejdzie na `structure`.

---

## 9. Przed wdrożeniem etapów 1–5

1. **Test ręczny na kopii danych** (np. `docker compose` z osobną bazą albo dev server + `POSTGRES_DB=dart_e2e` po `loaddata` zrzutu i `migrate`). Ścieżki do przeklikania:
   - nowy turniej SKO z liczbą graczy różną od potęgi 2 (wolne losy) i z placeholderem;
   - turniej grupowy: wyniki w grupach, „Generuj play-off”, finał, zakładka Statystyki i karta zwycięzcy;
   - „Symuluj”, „Wpisz wynik”, „Symuluj na żywo” i rozgrywka na żywo dla człowieka;
   - „Losuj ponownie” i „Zatwierdź” w szkicu;
   - stary turniej po migracji (np. #16) i punktacja cyklu.
2. **Kopia bazy produkcyjnej przed deployem** (`pg_dump`). Migracja 0014 ma `backward`, ale słupy utworzone z placeholderów zostają po cofnięciu.
3. **Jeden deploy:** backend i frontend razem (stary klient wysyła `PATCH bracket`, który teraz dostaje 400).

## 10. Zmiany zachowania widoczne dla użytkownika

- Wolny los kończy się automatycznie, a gracz przechodzi dalej (dotąd turniej zostawał aktywny na zawsze).
- Losowanie SKO używa standardowego rozstawienia (pozycje 1–8, 4–5, 2–7, 3–6…): zawodnicy dostają numery losowo, a wolne losy przypadają na najwyższe numery. Są więc rozłożone po połówkach i ćwiartkach, a zawodnicy z wolnym losem spotykają się w 2. rundzie tylko wtedy, gdy wolnych losów jest więcej niż ćwierć drabinki. Dotąd stały w losowych miejscach, także obok siebie (wykryte w teście ręcznym 2026-10-14).
- Playoff po grupach: zwycięzcy grup to rozstawienia 1…g (dostają ewentualne wolne losy), a w 1. rundzie nie spotyka się dwóch graczy z tej samej grupy, jeśli da się tego uniknąć. Przy 2/4/8 grupach pary są takie jak dotąd (A1 z drugim ostatniej grupy…), ale A1 i B1 trafiają do przeciwnych połówek. Przy 3, 5, 6 i 7 grupach znika mecz „pusty–pusty”.
- Tabela grupy liczy bilans **legów** (dotąd przy `sets = 1` liczyła mecze jako legi). Kolejność w tabeli może się zmienić przy remisie punktowym.
- Wyniku nie da się zapisać w niezatwierdzonym szkicu (dotąd blokował to tylko UI).
- Statystyki meczu zapisują się dopiero po przyjęciu wyniku przez serwer (odrzucony wynik nie zostawia osieroconych statystyk).
- Placeholder z kreatora tworzy gracza bez konta (słup), widocznego na liście graczy jak każdy słup.

## 11. Uwagi do etapu 6

- **Cofnięcie migracji 0015** działa tylko do momentu utworzenia pierwszego nowego turnieju: nowe turnieje mają `legacy_bracket = NULL`, a stare pole `bracket` było `NOT NULL`. Po wdrożeniu realnym powrotem jest kopia bazy.
- **`legacy_import.py` zostaje**, bo importuje go migracja 0014 (na pustej bazie nic nie robi). Działa wyłącznie na modelach historycznych.

## 12. Etap 7: łączenie konta ze słupami (projekt)

**Scenariusz.** Gracz A gra w turniejach gracza B jako słup (gracz bez konta, właścicielem jest B). Później A zakłada konto i chce mieć te turnieje w swoich statystykach. A prosi B o powiązanie. B **nie przegląda zarejestrowanych kont**: A przekazuje mu kod.

**Przepływ:**
1. A (z profilem gracza) w Profilu generuje **kod powiązania**, np. `K7QM-3XPA`: 8 znaków bez mylących liter, ważny 7 dni, wielokrotnego użytku w tym czasie (różni organizatorzy, kilka słupów). Nowy kod unieważnia poprzedni; A może kod unieważnić.
2. B w Hubie → „Gracze bez konta” widzi swoje słupy z listą turniejów, wybiera słup i wpisuje kod.
3. Serwer pokazuje B, do kogo należy kod (nazwa profilu A, którą A świadomie udostępnił). B potwierdza.
4. Słup dostaje `merged_into = profil A`. Historia turniejów się nie zmienia (wpisy dalej wskazują słup i zachowują ówczesną nazwę), ale **tożsamość A obejmuje profil i wszystkie powiązane słupy**.
5. Powiązanie może cofnąć B (właściciel słupa) albo A (właściciel konta).

**Co obejmuje tożsamość A (profil + powiązane słupy):**
- `my-stats` (statystyki z turniejów);
- `my-events`;
- widoczność prywatnych turniejów, w których grał słup;
- klasyfikacja cykli (punkty słupa i profilu sumują się w jednym wierszu).

**Reguły:**
- Powiązać można tylko własny słup: `owner = B`, bez konta, nie bot, jeszcze niepowiązany.
- Celem musi być profil z kontem.
- Odmowa, jeśli A i słup (albo inny słup A) grali w tym samym turnieju, bo A wystąpiłby w nim dwa razy.
- Powiązane słupy znikają z listy graczy (wyboru w kreatorze). Wybranie powiązanego słupa w kreatorze zapisuje uczestnika jako profil A.

**Poza zakresem (osobne decyzje):**
- Placeholdery w ligach (`LeagueMember.player = NULL`) nie są słupami. Ich przeniesienie to osobny krok.
- Globalna lista graczy (`GET /players/`) pokazuje wszystkim wszystkich zarejestrowanych graczy (m.in. w kreatorze). To kłóci się z zasadą „B nie widzi zarejestrowanych”. Do decyzji.

## 13. Widoczność graczy i kontakty (decyzja 2026-10-14)

- **Organizator widzi wyłącznie** własne boty, własnych graczy bez konta, własny profil oraz **kontakty**: zarejestrowanych graczy, którzy podali mu kod. Dotyczy to listy graczy (`GET /players/`), kreatora turnieju i składu ligi. Niezalogowany nie widzi nikogo.
- **Kontakt powstaje z kodu gracza:** bezpośrednio (Hub → Gracze → „Dodaj przez kod”, np. gracz jeszcze nie grał u organizatora) albo przy łączeniu słupa kodem. Usunąć go może organizator lub gracz (Profil → „Odbierz dostęp”).
- **Słup można połączyć z kontaktem bez nowego kodu,** bo zgoda została już wyrażona. Tak działa łączenie członka ligi w składzie ligi.
- **Edytować i usuwać gracza może tylko jego właściciel.** Dotąd mógł to zrobić każdy zalogowany.
- **Placeholdery w ligach są słupami** (migracja `leagues/0003`). API ligi podaje dla połączonego słupa `player_id` profilu.
- **Skutek na produkcji** (kopia z 2026-10-14): organizator `Bartosz` widzi 92 boty, 1 słup i swój profil. Pozostałe konta (testowe) znikają z jego listy, dopóki nie podadzą kodu. 2 słupy i 6 botów bez właściciela (sprzed pola `owner`) nie są widoczne dla nikogo.

**Incydent 2026-10-14 22:41:** testowy backend z wczesną wersją etapu 7 został uruchomiony na produkcyjnej bazie `dart` (brak `POSTGRES_DB=dart_e2e`). Wykonał `players.0011` (pusta kolumna `merged_into` i tabela kodów), a na profilu `Bartosz` wygenerowano jeden kod. Bez wpływu na działanie. Dlatego `0011` musi pozostać w tej treści, a kontakty są w osobnej `0012`.
