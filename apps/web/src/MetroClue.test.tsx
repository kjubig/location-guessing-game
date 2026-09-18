import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { MetroClue } from "./MetroClue";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders anonymous metro lines and stations from a valid clue", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          canvas: { width: 1000, height: 760 },
          lines: [
            {
              points: [
                [100, 100],
                [500, 300],
                [800, 700],
              ],
            },
          ],
          stations: [[500, 300]],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    ),
  );

  const { container } = render(
    <MetroClue
      errorLabel="Failed"
      label="Metro clue"
      loadingLabel="Loading"
      url="/clues/metro/opaque.json"
    />,
  );

  expect(await screen.findByRole("img", { name: "Metro clue" })).toBeTruthy();
  expect(container.querySelectorAll("polyline")).toHaveLength(1);
  expect(container.querySelectorAll("circle")).toHaveLength(1);
});
