import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeaderboardPanel } from "./LeaderboardPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LeaderboardPanel", () => {
  it("renders server-ranked entries as text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          entries: [
            { nickname: "민수", rank: 1, score: 24_000 },
            { nickname: "Player <script>", rank: 2, score: 21_500 },
          ],
          mode: "metro",
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LeaderboardPanel
        emptyLabel="No results"
        loadingLabel="Loading"
        mode="metro"
        title="Leaderboard"
      />,
    );

    expect(await screen.findByText("민수")).toBeTruthy();
    expect(screen.getByText("Player <script>")).toBeTruthy();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("/api/leaderboard?mode=metro");
    expect(call[1].signal).toBeInstanceOf(AbortSignal);
  });
});
