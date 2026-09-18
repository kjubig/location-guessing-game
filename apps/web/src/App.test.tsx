import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameSnapshot } from "@golukituki/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import i18n from "./i18n";

vi.mock("./GuessMap", () => ({
  GuessMap: ({
    onSelect,
    result,
  }: {
    onSelect?: (coordinate: { latitude: number; longitude: number }) => void;
    result?: unknown;
  }) => (
    <button
      type="button"
      aria-label="Test map"
      onClick={() => onSelect?.({ latitude: 37.5, longitude: 127 })}
    >
      {result ? "Result map" : "Select test point"}
    </button>
  ),
}));

vi.mock("./MetroClue", () => ({
  MetroClue: ({ url }: { url: string }) => <div>Test metro clue: {url}</div>,
}));

vi.mock("./LeaderboardPanel", () => ({
  LeaderboardPanel: ({ mode }: { mode: string }) => (
    <div>Test leaderboard: {mode}</div>
  ),
}));

vi.mock("./TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("test-token")}>
      Complete human verification
    </button>
  ),
}));

const firstRound: GameSnapshot = {
  completedRounds: [],
  currentRound: {
    attribution: "Contains modified Copernicus Sentinel data (2025)",
    clueUrl: "/clues/opaque.png",
    roundId: "round-1",
    roundNumber: 1,
    totalRounds: 5,
  },
  gameId: "game-1",
  mode: "satellite",
  nickname: "Tester",
  status: "active",
  totalScore: 0,
};

const afterGuess: GameSnapshot = {
  ...firstRound,
  completedRounds: [
    {
      answer: { latitude: 37.54, longitude: 126.95 },
      attribution: "Contains modified Copernicus Sentinel data (2025)",
      clueUrl: "/clues/opaque.png",
      distanceKm: 12.3,
      guess: { latitude: 37.5, longitude: 127 },
      points: 3_910,
      roundNumber: 1,
    },
  ],
  currentRound: {
    ...firstRound.currentRound!,
    clueUrl: "/clues/next.png",
    roundId: "round-2",
    roundNumber: 2,
  },
  totalScore: 3_910,
};

const metroRound: GameSnapshot = {
  ...firstRound,
  currentRound: {
    ...firstRound.currentRound!,
    attribution: "© OpenStreetMap contributors (ODbL)",
    clueUrl: "/clues/metro/opaque.json",
  },
  mode: "metro",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("pl");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("satellite game flow", () => {
  it("opens the dedicated sources page and returns home", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Źródła i licencje" }));

    expect(
      screen.getByRole("heading", { name: "Źródła i licencje", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText("Copernicus Sentinel-2")).toBeTruthy();
    expect(screen.getByText("OpenStreetMap")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Wróć do gry" }));
    expect(screen.getByLabelText("Twój nick")).toBeTruthy();
  });

  it("starts a game, selects a map point, and displays the server result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(firstRound, 201))
      .mockResolvedValueOnce(jsonResponse(afterGuess));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByLabelText("Twój nick"), "Tester");
    await user.click(
      screen.getByRole("button", { name: "Complete human verification" }),
    );
    await user.click(screen.getByRole("button", { name: "Rozpocznij grę" }));

    expect(await screen.findByText(/Runda 1/)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Zatwierdź strzał" });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    await user.click(await screen.findByRole("button", { name: "Test map" }));
    expect(confirm.hasAttribute("disabled")).toBe(false);
    await user.click(confirm);

    expect(
      (
        await screen.findAllByText(
          (content) => content.replace(/\s/g, "") === "3910pkt",
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("12.3 km")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("golukituki.activeGameId")).toBe("game-1");
  });

  it("restores an unfinished game after a page reload", async () => {
    localStorage.setItem("golukituki.activeGameId", "game-1");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(firstRound));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText(/Runda 1/)).toBeTruthy();
    expect(screen.getByText("Tester")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/games/game-1");
  });

  it("starts the selected metro mode and renders its anonymous clue", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(metroRound, 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: /Metro/ }));
    await user.type(screen.getByLabelText("Twój nick"), "Tester");
    await user.click(
      screen.getByRole("button", { name: "Complete human verification" }),
    );
    await user.click(screen.getByRole("button", { name: "Rozpocznij grę" }));

    expect(await screen.findByText(/Test metro clue/)).toBeTruthy();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      nickname: "Tester",
      mode: "metro",
      turnstileToken: "test-token",
    });
  });
});
