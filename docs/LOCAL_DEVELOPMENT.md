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
pnpm dev
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

## Typowe problemy

- Brak `pnpm`: wykonaj polecenia Corepack z sekcji 1.
- Błąd `/api/health`: upewnij się, że proces Workera działa na porcie 8787.
- Błąd migracji remote: placeholder D1 nie został jeszcze zastąpiony prawdziwym
  `database_id`.
- Zajęty port: zakończ poprzedni `pnpm dev` albo sprawdź proces korzystający z
  portu 5173/8787.
