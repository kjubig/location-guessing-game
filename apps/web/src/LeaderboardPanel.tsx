import type {
  ApiErrorResponse,
  GameMode,
  LeaderboardResponse,
} from "@golukituki/core";
import { useEffect, useState } from "react";

interface LeaderboardPanelProps {
  emptyLabel: string;
  loadingLabel: string;
  mode: GameMode;
  title: string;
}

export function LeaderboardPanel({
  emptyLabel,
  loadingLabel,
  mode,
  title,
}: LeaderboardPanelProps) {
  const [state, setState] = useState<
    | { mode: GameMode; status: "ready"; value: LeaderboardResponse }
    | { mode: GameMode; status: "error" }
  >();
  const currentState = state?.mode === mode ? state : undefined;

  useEffect(() => {
    const controller = new AbortController();

    void fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/leaderboard?mode=${mode}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json()) as
          LeaderboardResponse | ApiErrorResponse;
        if (!response.ok) {
          throw new Error((body as ApiErrorResponse).error.message);
        }
        setState({
          mode,
          status: "ready",
          value: body as LeaderboardResponse,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setState({ mode, status: "error" });
      });

    return () => controller.abort();
  }, [mode]);

  return (
    <section className="leaderboard" aria-labelledby={`leaderboard-${mode}`}>
      <div className="leaderboard__heading">
        <h2 id={`leaderboard-${mode}`}>{title}</h2>
        <span>TOP 10</span>
      </div>
      {!currentState ? (
        <p className="leaderboard__status">{loadingLabel}</p>
      ) : currentState.status === "error" ||
        currentState.value.entries.length === 0 ? (
        <p className="leaderboard__status">{emptyLabel}</p>
      ) : (
        <ol className="leaderboard__list">
          {currentState.value.entries.map((entry) => (
            <li key={`${entry.rank}-${entry.nickname}`}>
              <span className="leaderboard__rank">{entry.rank}</span>
              <span className="leaderboard__nickname">{entry.nickname}</span>
              <strong>{entry.score.toLocaleString()} pkt</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
