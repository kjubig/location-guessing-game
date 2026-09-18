# Wdrożenie: GitHub, Cloudflare Worker i D1

Status: prywatne repozytorium GitHub połączone; konfiguracja Cloudflare oczekuje
na wykonanie przez właściciela  
Ostatnia aktualizacja: 2026-09-18

Ten dokument celowo rozdziela trzy rzeczy, które często są mylone:

- **GitHub Actions (CI)** sprawdza kod, ale niczego nie wdraża;
- **Cloudflare Workers Builds (CD)** obserwuje GitHuba i publikuje Workera;
- **D1** jest osobną bazą danych, której migracje wykonujemy jawnie.

## 1. Co już przygotowuje repozytorium

`apps/worker/wrangler.jsonc` opisuje trzy konteksty:

| Kontekst   | Worker                  | D1                      | Do czego służy                   |
| ---------- | ----------------------- | ----------------------- | -------------------------------- |
| local      | lokalny proces Wrangler | `golukituki-local`      | praca bez konta Cloudflare       |
| production | `golukituki`            | `golukituki-production` | publiczna wersja z gałęzi `main` |
| preview    | `golukituki-preview`    | `golukituki-preview`    | testy innych gałęzi i PR-ów      |

Oddzielna baza podglądowa jest ważna: rozegranie testowej partii nie może
zmienić rankingu produkcyjnego.

Identyfikatory baz w konfiguracji są na razie zerowymi placeholderami. Nie są
sekretami, ale przed zdalnym wdrożeniem trzeba zastąpić je UUID-ami zwróconymi
przez Cloudflare.

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

Włącz **Builds for non-production branches**. Produkcyjne polecenie wykonuje
`wrangler deploy --env production`, natomiast polecenie podglądowe wykonuje
`wrangler versions upload --env preview`. Upload wersji tworzy publiczny,
wersjonowany adres podglądu, ale nie promuje jej do aktywnego wdrożenia.

Cloudflare wykrywa wersję Node z `.node-version`, a wersję pnpm z pola
`packageManager` w `package.json`. `--frozen-lockfile` przerywa build, jeżeli
manifesty i `pnpm-lock.yaml` przestaną być zgodne.

## 5. Pierwsza weryfikacja po wdrożeniu

Sprawdź kolejno:

1. GitHub Actions dla commita na `main` ma zielony job `Validate workspace`.
2. Workers Builds zakończył osobno krok build i deploy.
3. Publiczny adres `https://golukituki.<subdomain>.workers.dev/` zwraca stronę.
4. `https://golukituki.<subdomain>.workers.dev/api/health` zwraca m.in.
   `"status":"ok"` i `"environment":"production"`.
5. Commit na nowej gałęzi generuje adres wersji Workera `golukituki-preview`.
6. Odpowiedź `/api/health` podglądu zawiera `"environment":"preview"`.

Adresy preview są publiczne. Jeśli później pojawią się tam dane, których nie
powinni widzieć wszyscy znający URL, trzeba zabezpieczyć je Cloudflare Access.

## 6. Codzienny przepływ zmian

1. Utwórz gałąź roboczą.
2. Zmień kod i uruchom `pnpm validate` oraz `pnpm pipeline:test`.
3. Wypchnij gałąź; GitHub Actions sprawdzi kod, a Workers Builds utworzy preview.
4. Przejrzyj preview i połącz pull request do `main`.
5. Push/merge do `main` automatycznie publikuje produkcję.

Migracje bazy są wyjątkiem: obecnie nie wykonują się automatycznie. Najpierw
migruj bazę preview, przetestuj aplikację, a produkcję migruj bezpośrednio przed
wdrożeniem kompatybilnego kodu. Migracje powinny być wstecznie kompatybilne, np.
najpierw dodawać kolumnę, a dopiero w późniejszym wydaniu usuwać starą.

## 7. Cofnięcie wadliwej wersji

Najprostszy bezpieczny rollback kodu to odwrócenie wadliwego commita nowym
commitem (`git revert <sha>`) i wypchnięcie go do `main`. Zachowuje to historię i
uruchamia zwykłe CI/CD. Nie cofaj automatycznie migracji D1: najpierw oceń dane i
przygotuj nową migrację naprawczą.

## 8. Gdzie szukać problemu

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
