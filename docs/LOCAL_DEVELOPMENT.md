# Lokalne środowisko programistyczne

## 1. Node.js i pnpm

Projekt wskazuje Node.js 24 w `.node-version`. pnpm jest uruchamiany przez
Corepack dołączony do Node.js, dzięki czemu każdy używa tej samej wersji:

```powershell
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
```

`pnpm install` czyta wszystkie `package.json`, pobiera biblioteki i tworzy jeden
`pnpm-lock.yaml`. Foldery robocze są połączone przez `workspace:*`, więc np.
frontend używa lokalnego `@golukituki/core`, a nie pakietu z internetu.

## 2. Uruchomienie

```powershell
corepack pnpm dev
```

Polecenie najpierw buduje pakiet webowy potrzebny Wranglerowi, a potem uruchamia
równolegle:

- Vite na `http://localhost:5173`;
- Worker na `http://localhost:8787`.

Otwórz port 5173. Żądania `/api/*` Vite przekazuje na port 8787.

## 3. Lokalna baza D1

```powershell
pnpm db:migrate:local
```

Wrangler tworzy lokalną bazę w ignorowanym folderze `.wrangler/` i wykonuje pliki
z `migrations/`. Nie łączy się przy tym z produkcją.

## 4. Sprawdzenie projektu

```powershell
pnpm validate
pnpm pipeline:test
```

`validate` kolejno sprawdza format, reguły ESLint, typy, testy i pełny build.
Każda część kończy proces kodem błędu, więc CI może zablokować wadliwą zmianę.

## 5. Zmienne i sekrety

`.env.example` opisuje nazwy zmiennych, ale nie zawiera wartości. Sekrety Workera
do lokalnej pracy trafiają do `apps/worker/.dev.vars`, który jest ignorowany przez
Git. W Cloudflare ustawia się je jako secrets, nigdy jako plik w repozytorium.

M3 używa oficjalnych testowych kluczy Turnstile. Repozytorium zawiera publiczny
testowy sitekey w `.env.example` i wzór testowego sekretu w
`apps/worker/.dev.vars.example`. Po świeżym klonowaniu wykonaj:

```powershell
Copy-Item apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Testowe klucze działają wyłącznie z testowymi tokenami i są przeznaczone do
localhost/CI. Nie dają dostępu do konta Cloudflare i nie wolno ich używać na
produkcji. Prawdziwy sekret nigdy nie otrzymuje prefiksu `VITE_`, bo wszystko z
tym prefiksem Vite umieszcza w kodzie wysyłanym do przeglądarki.

Widget tworzy token w przeglądarce. Frontend dołącza go do `POST /api/games`, a
Worker wysyła go wraz z sekretem do Cloudflare Siteverify. Token ma maksymalnie
2048 znaków, wygasa po 5 minutach i jest jednorazowy. Po błędzie formularz
montuje nowy widget zamiast próbować ponownie użyć starego tokenu.

Lokalne narzędzie Wrangler udostępnia binding Rate Limiting, ale nie egzekwuje
lokalnie limitów. Zachowanie `429` jest dlatego pokryte testem z kontrolowanym
mockiem, a realne egzekwowanie sprawdza się na środowisku preview.

## Typowe problemy

- Brak `pnpm`: użyj `corepack pnpm <polecenie>` albo wykonaj polecenia Corepack
  z sekcji 1, aby aktywować skrót `pnpm` globalnie. Skrypty repozytorium same
  wywołują zagnieżdżone polecenia przez Corepack, więc
  `corepack pnpm dev` działa również bez wcześniejszego `corepack enable`.
- Błąd `/api/health`: upewnij się, że proces Workera działa na porcie 8787.
- Błąd migracji remote: placeholder D1 nie został jeszcze zastąpiony prawdziwym
  `database_id`.
- Przycisk startu pozostaje nieaktywny: sprawdź połączenie z
  `challenges.cloudflare.com` oraz testowy `VITE_TURNSTILE_SITE_KEY`.
- Zajęty port: zakończ poprzedni `pnpm dev` albo sprawdź proces korzystający z
  portu 5173/8787.
