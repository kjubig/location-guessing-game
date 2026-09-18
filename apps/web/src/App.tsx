import type {
  ApiErrorResponse,
  Coordinate,
  GameMode,
  GameSnapshot,
} from "@golukituki/core";
import { APP_NAME } from "@golukituki/core/identity";
import {
  type FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { MetroClue } from "./MetroClue";
import { LeaderboardPanel } from "./LeaderboardPanel";

const GuessMap = lazy(() =>
  import("./GuessMap").then((module) => ({ default: module.GuessMap })),
);

type Theme = "dark" | "light";
const STORAGE_KEY = "golukituki.activeGameId";

function getInitialTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? ""}${path}`,
    {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    },
  );
  const body = (await response.json().catch(() => undefined)) as
    T | ApiErrorResponse | undefined;
  if (!body) {
    throw new Error(`Server returned an empty response (${response.status})`);
  }
  if (!response.ok) throw new Error((body as ApiErrorResponse).error.message);
  return body as T;
}

export function App() {
  const { i18n, t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [nickname, setNickname] = useState("");
  const [selectedMode, setSelectedMode] = useState<GameMode>("satellite");
  const [game, setGame] = useState<GameSnapshot>();
  const [guess, setGuess] = useState<Coordinate>();
  const [showResult, setShowResult] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const gameId = localStorage.getItem(STORAGE_KEY);
    if (!gameId) return;
    void apiRequest<GameSnapshot>(`/api/games/${gameId}`)
      .then(setGame)
      .catch(() => localStorage.removeItem(STORAGE_KEY));
  }, []);

  const selectGuess = useCallback((coordinate: Coordinate) => {
    setGuess(coordinate);
  }, []);

  const startGame = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const snapshot = await apiRequest<GameSnapshot>("/api/games", {
        body: JSON.stringify({ nickname, mode: selectedMode }),
        method: "POST",
      });
      localStorage.setItem(STORAGE_KEY, snapshot.gameId);
      setGame(snapshot);
      setGuess(undefined);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("genericError"),
      );
    } finally {
      setPending(false);
    }
  };

  const submitGuess = async () => {
    if (!game || !guess) return;
    setPending(true);
    setError(undefined);
    try {
      const snapshot = await apiRequest<GameSnapshot>(
        `/api/games/${game.gameId}/guesses`,
        { body: JSON.stringify(guess), method: "POST" },
      );
      setGame(snapshot);
      setShowResult(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("genericError"),
      );
    } finally {
      setPending(false);
    }
  };

  const continueGame = () => {
    if (game?.status === "complete") localStorage.removeItem(STORAGE_KEY);
    setGuess(undefined);
    setShowResult(false);
  };

  const result = showResult ? game?.completedRounds.at(-1) : undefined;
  const round = game?.currentRound;
  const clueUrl = result?.clueUrl ?? round?.clueUrl;
  const attribution = result?.attribution ?? round?.attribution;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand brand-button"
          onClick={() => setGame(undefined)}
        >
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>{APP_NAME}</span>
        </button>
        <div className="toolbar">
          {game && (
            <span className="score-pill">
              {game.totalScore.toLocaleString()} pkt
            </span>
          )}
          <button
            className="icon-button"
            onClick={() =>
              void i18n.changeLanguage(
                i18n.language.startsWith("pl") ? "en" : "pl",
              )
            }
          >
            {t("language")}
          </button>
          <button
            className="icon-button"
            aria-label={t("theme")}
            onClick={() =>
              setTheme((value) => (value === "light" ? "dark" : "light"))
            }
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
        </div>
      </header>

      {!game ? (
        <main className="start-screen">
          <section className="start-copy">
            <p className="eyebrow">
              {selectedMode === "metro" ? "M2" : "M1"} · {t(selectedMode)}
            </p>
            <h1>
              {t(selectedMode === "metro" ? "playTitleMetro" : "playTitle")}
            </h1>
            <p className="hero-description">
              {t(
                selectedMode === "metro"
                  ? "playDescriptionMetro"
                  : "playDescription",
              )}
            </p>
            <LeaderboardPanel
              emptyLabel={t("leaderboardEmpty")}
              loadingLabel={t("leaderboardLoading")}
              mode={selectedMode}
              title={t("leaderboardTitle")}
            />
          </section>
          <form
            className="start-card"
            onSubmit={(event) => void startGame(event)}
          >
            <fieldset className="mode-picker">
              <legend>{t("chooseMode")}</legend>
              {(["satellite", "metro"] as const).map((mode) => (
                <button
                  aria-pressed={selectedMode === mode}
                  className="mode-picker__button"
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  type="button"
                >
                  <strong>{t(mode)}</strong>
                  <span>{t(`${mode}Short`)}</span>
                </button>
              ))}
            </fieldset>
            <label htmlFor="nickname">{t("nicknameLabel")}</label>
            <input
              id="nickname"
              maxLength={20}
              minLength={2}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={t("nicknamePlaceholder")}
              required
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={pending}>
              {pending ? t("loading") : t("startGame")}
            </button>
            <small>{t("fiveRounds")}</small>
          </form>
        </main>
      ) : game.status === "complete" && !showResult ? (
        <main className="summary-screen">
          <p className="eyebrow">{t("gameComplete")}</p>
          <h1>{game.totalScore.toLocaleString()} / 25 000</h1>
          <div className="summary-list">
            {game.completedRounds.map((item) => (
              <div key={item.roundNumber}>
                <span>
                  {t("round")} {item.roundNumber}
                </span>
                <strong>{item.points.toLocaleString()} pkt</strong>
              </div>
            ))}
          </div>
          <LeaderboardPanel
            emptyLabel={t("leaderboardEmpty")}
            loadingLabel={t("leaderboardLoading")}
            mode={game.mode}
            title={t("leaderboardTitle")}
          />
          <button
            className="primary-button"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setGame(undefined);
              setNickname("");
            }}
          >
            {t("playAgain")}
          </button>
        </main>
      ) : (
        <main className="game-screen">
          <section className="clue-panel">
            <div className="round-heading">
              <span>
                {t("round")} {result?.roundNumber ?? round?.roundNumber} / 5
              </span>
              <strong>{game.nickname}</strong>
            </div>
            {game.mode === "metro" && clueUrl ? (
              <MetroClue
                errorLabel={t("metroClueError")}
                label={t("metroAlt")}
                loadingLabel={t("metroClueLoading")}
                url={clueUrl}
              />
            ) : (
              <img
                className="clue-image"
                src={clueUrl}
                alt={t("satelliteAlt")}
              />
            )}
            <small>{attribution}</small>
          </section>
          <section className="map-panel">
            <Suspense
              fallback={<div className="map-loading">{t("mapLoading")}</div>}
            >
              <GuessMap
                mode={game.mode}
                selected={guess}
                onSelect={selectGuess}
                disabled={showResult}
                result={result}
                label={t("guessMap")}
              />
            </Suspense>
            {result ? (
              <div className="result-bar">
                <div>
                  <strong>{result.points.toLocaleString()} pkt</strong>
                  <span>{result.distanceKm.toFixed(1)} km</span>
                </div>
                <button className="primary-button" onClick={continueGame}>
                  {game.status === "complete" ? t("summary") : t("nextRound")}
                </button>
              </div>
            ) : (
              <button
                className="primary-button guess-button"
                disabled={!guess || pending}
                onClick={() => void submitGuess()}
              >
                {pending ? t("loading") : t("confirmGuess")}
              </button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
