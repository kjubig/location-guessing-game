# Wdrożenie: GitHub, Cloudflare Worker i D1

Status: M5 w toku; D1, Turnstile oraz Workery production/preview działają;
pozostało połączenie Workers Builds i pełne testy gry
Ostatnia aktualizacja: 2026-09-20

Ten dokument celowo rozdziela trzy rzeczy, które często są mylone:

- **GitHub Actions (CI)** sprawdza kod, ale niczego nie wdraża;
- **Cloudflare Workers Builds (CD)** obserwuje GitHuba i publikuje Workera;
- **D1** jest osobną bazą danych, której migracje wykonujemy jawnie.

Pełny dziennik pierwszego wdrożenia wraz z wyjaśnieniem przepływu żądań i
protokołem testów znajduje się w [`milestones/M5.md`](milestones/M5.md).

## 1. Co już przygotowuje repozytorium

`apps/worker/wrangler.jsonc` opisuje trzy konteksty:

| Kontekst   | Worker                  | D1                      | Do czego służy                   |
| ---------- | ----------------------- | ----------------------- | -------------------------------- |
| local      | lokalny proces Wrangler | `golukituki-local`      | praca bez konta Cloudflare       |
| production | `golukituki`            | `golukituki-production` | publiczna wersja z gałęzi `main` |
| preview    | `golukituki-preview`    | `golukituki-preview`    | testy innych gałęzi i PR-ów      |

Oddzielna baza podglądowa jest ważna: rozegranie testowej partii nie może
zmienić rankingu produkcyjnego.

Identyfikatory produkcyjnej i podglądowej bazy zostały zapisane w konfiguracji
2026-09-20. Nie są sekretami. Zerowy identyfikator pozostaje wyłącznie w lokalnym
wiązaniu i wskazuje Wranglerowi, że ma używać lokalnych plików `.wrangler/`.

## 2. Utworzenie prywatnego repozytorium GitHub

Stan projektu: wykonane 2026-09-18. Repozytorium znajduje się pod adresem
[`kjubig/location-guessing-game`](https://github.com/kjubig/location-guessing-game),
a lokalna gałąź `main` śledzi `origin/main`.

Poniższa procedura pozostaje udokumentowana, aby wyjaśnić, jak ten etap został
wykonany i jak odtworzyć go przy kolejnym projekcie.

1. Na GitHubie utwórz prywatne repozytorium `location-guessing-game`.
2. Nie dodawaj przez formularz README, `.gitignore` ani licencji — te pliki już
   istnieją lokalnie.
3. Po utworzeniu skopiuj adres repozytorium i dodaj go lokalnie:

```powershell
git remote add origin https://github.com/TWOJ_LOGIN/location-guessing-game.git
git branch -M main
git push -u origin main
```

Adres SSH (`git@github.com:...`) też jest poprawny, jeżeli klucz SSH jest już
skonfigurowany. Nazwa repozytorium może być później zmieniona; nazwa produktu i
pakietów nie zależy od adresu GitHuba.

## 3. Utworzenie dwóch baz D1

Po zalogowaniu Wranglera (`pnpm exec wrangler login`) utwórz bazy:

```powershell
pnpm --filter @golukituki/worker exec wrangler d1 create golukituki-production --location weur
pnpm --filter @golukituki/worker exec wrangler d1 create golukituki-preview --location weur
```

`weur` jest wskazówką umieszczenia bazy w Europie Zachodniej, a nie gwarancją
pojedynczego centrum danych. Każde polecenie zwróci `database_id`. Wstaw pierwszy
UUID w `env.production`, a drugi w `env.preview` w `wrangler.jsonc`. Nie zmieniaj
lokalnego zerowego UUID — lokalny tryb korzysta z plików w `.wrangler/`.

Następnie zastosuj migracje do każdej zdalnej bazy:

```powershell
pnpm db:migrate:preview
pnpm db:migrate:production
```

Stan projektu: wykonane 2026-09-20. Migracje `0001`–`0005` najpierw przeszły na
preview, a następnie na produkcji. Kontrolne zapytanie tylko do odczytu zwróciło
w obu bazach 5 aktywnych wskazówek metra, 90 aktywnych wskazówek satelitarnych i
5 wyłączonych fixture'ów M1.

Wrangler pokazuje listę migracji przed wykonaniem. D1 wykonuje migrację
transakcyjnie: nieudany plik jest wycofywany, a wcześniejsze poprawne migracje
pozostają zastosowane. Przed zdalnym wykonaniem zawsze najpierw uruchom:

```powershell
pnpm db:migrate:local
pnpm validate
```

## 4. Połączenie repozytorium z Workers Builds

W panelu Cloudflare przejdź do **Workers & Pages → Create application → Import a
repository**, połącz konto GitHub i wybierz prywatne repozytorium. Nazwa Workera
w panelu powinna być `golukituki`, czyli taka sama jak produkcyjna nazwa w
`wrangler.jsonc`.

Ustawienia buildu:

| Pole                                 | Wartość                                                          |
| ------------------------------------ | ---------------------------------------------------------------- |
| Production branch                    | `main`                                                           |
| Root directory                       | `/` (korzeń repozytorium)                                        |
| Build command                        | `corepack pnpm install --frozen-lockfile && corepack pnpm build` |
| Deploy command                       | `corepack pnpm --filter @golukituki/worker deploy:production`    |
| Non-production branch deploy command | `corepack pnpm --filter @golukituki/worker deploy:preview`       |

Połącz repozytorium osobno z Workerem `golukituki` oraz
`golukituki-preview`, ponieważ są to dwa środowiskowe Workery z innymi bazami,
sekretami i buildowymi sitekeyami. Produkcyjny Worker nasłuchuje `main`.
Podglądowy Worker używa `wrangler deploy --env preview` dla swojej gałęzi
produkcyjnej i `wrangler versions upload --env preview` dla innych gałęzi.

Włącz **Builds for non-production branches** na Workerze preview. Upload wersji
tworzy publiczny, wersjonowany adres podglądu, ale nie promuje jej do aktywnego
wdrożenia. Pierwsze utworzenie Workera preview jest wyjątkiem: trzeba jeden raz
wykonać `wrangler deploy --env preview`, ponieważ nie można wgrać wersji do
nieistniejącego jeszcze Workera. Ten bootstrap wykonano 2026-09-20.

Cloudflare wykrywa wersję Node z `.node-version`, a wersję pnpm z pola
`packageManager` w `package.json`. `--frozen-lockfile` przerywa build, jeżeli
manifesty i `pnpm-lock.yaml` przestaną być zgodne.

## 5. Turnstile przed pierwszym wdrożeniem M3

Stan projektu: wykonane 2026-09-20. Istnieją osobne widgety `GEOLUKITUKI
production` i `GEOLUKITUKI preview`. Cloudflare zaleca rozdzielenie środowisk.
W Hostname Management podaje się sam hostname bez `https://`, portu ani ścieżki.
Gwiazdki nie są obsługiwane, ale wpisanie domeny nadrzędnej automatycznie
dopuszcza jej subdomeny.

Produkcja dopuszcza wyłącznie
`golukituki.golukituki-worker.workers.dev`. Preview dopuszcza nadrzędny hostname
`golukituki-worker.workers.dev`, ponieważ adresy gałęzi mają dynamiczny prefiks
`<wersja-lub-gałąź>-golukituki-preview`. Nie łączy to sekretów: każdy Worker ma
własny `TURNSTILE_SECRET_KEY` odpowiadający innemu widgetowi.

Dla każdego środowiska są dwie różne wartości:

- **sitekey** jest publiczny i trafia do zmiennej buildowej
  `VITE_TURNSTILE_SITE_KEY` właściwej gałęzi;
- **secret key** jest serwerowy i trafia bezpośrednio do Workera:

```powershell
corepack pnpm --filter @golukituki/worker exec wrangler secret put TURNSTILE_SECRET_KEY --env preview
corepack pnpm --filter @golukituki/worker exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Polecenia poproszą o wartość interaktywnie. Nie wpisuj sekretu do
`wrangler.jsonc`, GitHuba ani zmiennej zaczynającej się od `VITE_`. Build bez
publicznego sitekey zakończy się poprawnie, ale formularz pokaże kontrolowany
błąd i nie pozwoli utworzyć gry. Worker bez sekretu odrzuci token — jest to
celowe zachowanie fail-closed.

`wrangler.jsonc` ma trzy osobne namespace'y Rate Limiting. Każdy dopuszcza 20
prób utworzenia gry na 60 sekund dla jednego klucza IP. To łagodny bezpiecznik,
nie system rozliczeniowy: wspólne Wi-Fi/NAT może oznaczać jeden adres dla wielu
osób, a mechanizm Cloudflare jest lokalny dla centrów danych.

## 6. Pierwsza weryfikacja po wdrożeniu

Sprawdź kolejno:

1. GitHub Actions dla commita na `main` ma zielony job `Validate workspace`.
2. Workers Builds zakończył osobno krok build i deploy.
3. Publiczny adres `https://golukituki.<subdomain>.workers.dev/` zwraca stronę.
4. `https://golukituki.<subdomain>.workers.dev/api/health` zwraca m.in.
   `"status":"ok"` i `"environment":"production"`.
5. Commit na nowej gałęzi generuje adres wersji Workera `golukituki-preview`.
6. Odpowiedź `/api/health` podglądu zawiera `"environment":"preview"`.
7. Widget Turnstile działa na hostname preview, a ukończona gra pojawia się
   wyłącznie w rankingu preview.

Adresy preview są publiczne. Jeśli później pojawią się tam dane, których nie
powinni widzieć wszyscy znający URL, trzeba zabezpieczyć je Cloudflare Access.

Pierwsze adresy wdrożeń M5:

- produkcja: `https://golukituki.golukituki-worker.workers.dev`;
- stały preview: `https://golukituki-preview.golukituki-worker.workers.dev`.

2026-09-20 oba adresy zwróciły HTML ze statusem 200, a `/api/health` odpowiednio
`"environment":"production"` i `"environment":"preview"`.

## 7. Obserwowalność i wyczerpanie limitów

Worker zapisuje do Cloudflare Observability jeden mały rekord na żądanie API:
metodę, status HTTP, czas, nazwę środowiska i stałą nazwę zdarzenia. Celowo nie
loguje URL-a (zawiera identyfikator gry), nicku, współrzędnych, body ani tokenu.

W panelu Cloudflare sprawdzaj:

- udział odpowiedzi `429` — zbyt dużo prób startu gry;
- `TURNSTILE_FAILED` i analitykę widgetu — nieprawidłowe/wygasłe tokeny;
- odpowiedzi `503` — niedostępne Siteverify, D1 lub wyczerpany limit usługi;
- metryki D1: liczbę odczytanych/zapisanych wierszy i wykorzystanie miejsca;
- błędy wdrożenia oraz dzienny limit żądań Workera.

API zwraca kontrolowane komunikaty: `429` prosi o odczekanie minuty, błąd
Turnstile daje `403`, a przejściowa awaria weryfikacji lub D1 daje `503` bez
ujawniania szczegółów. Frontend pokazuje komunikat i zachowuje formularz do
ponowienia. Po przekroczeniu dziennego limitu nie próbujemy zapisywać wyniku
lokalnie w przeglądarce — po resecie limitu źródłem prawdy nadal jest D1.

## 8. Eksport i retencja D1

Przed ryzykowną migracją produkcji wykonaj eksport do katalogu poza
repozytorium:

```powershell
pnpm --filter @golukituki/worker exec wrangler d1 export golukituki-production `
  --remote --env production --output C:\secure-backups\golukituki.sql
```

Plik zawiera nicki, strzały i wyniki. Nie commituj go ani nie przesyłaj do
publicznego miejsca. W MVP ukończone gry i najlepsze wyniki pozostają w bazie,
żeby ranking był trwały; wygasłe aktywne gry są usuwane małymi porcjami podczas
tworzenia kolejnych gier. Zmiana retencji wymaga osobnej migracji lub zadania
sprzątającego i aktualizacji informacji dla graczy.

## 9. Codzienny przepływ zmian

1. Utwórz gałąź roboczą.
2. Zmień kod i uruchom `pnpm validate` oraz `pnpm pipeline:test`.
3. Wypchnij gałąź; GitHub Actions sprawdzi kod, a Workers Builds utworzy preview.
4. Przejrzyj preview i połącz pull request do `main`.
5. Push/merge do `main` automatycznie publikuje produkcję.

Migracje bazy są wyjątkiem: obecnie nie wykonują się automatycznie. Najpierw
migruj bazę preview, przetestuj aplikację, a produkcję migruj bezpośrednio przed
wdrożeniem kompatybilnego kodu. Migracje powinny być wstecznie kompatybilne, np.
najpierw dodawać kolumnę, a dopiero w późniejszym wydaniu usuwać starą.

## 10. Cofnięcie wadliwej wersji

Najprostszy bezpieczny rollback kodu to odwrócenie wadliwego commita nowym
commitem (`git revert <sha>`) i wypchnięcie go do `main`. Zachowuje to historię i
uruchamia zwykłe CI/CD. Nie cofaj automatycznie migracji D1: najpierw oceń dane i
przygotuj nową migrację naprawczą.

## 11. Gdzie szukać problemu

- **CI czerwone, Cloudflare jeszcze nie ruszył:** błąd jest w formatowaniu,
  lintowaniu, typach, testach albo buildzie.
- **CI zielone, Workers Build czerwony:** sprawdź nazwę Workera, komendy buildu,
  UUID-y D1 i log Wranglera.
- **Strona działa, `/api/health` nie:** żądanie nie trafia do Workera albo
  wdrożono niewłaściwe środowisko.
- **Preview zapisuje do produkcji:** natychmiast sprawdź `--env preview` i UUID
  bazy w sekcji `env.preview`.
- **Migracja zgłasza brak bazy:** placeholder UUID nie został zastąpiony albo
  Wrangler jest zalogowany do niewłaściwego konta.

## Oficjalne materiały

- [Konfiguracja Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Gałęzie produkcyjne i podglądowe](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
- [Adresy podglądu Workera](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)
- [Polecenia Wrangler dla D1](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Migracje D1](https://developers.cloudflare.com/d1/reference/migrations/)
- [Testowe klucze Turnstile](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Walidacja Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Hostname Management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
