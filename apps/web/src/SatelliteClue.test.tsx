import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SatelliteClue } from "./SatelliteClue";

afterEach(cleanup);

describe("SatelliteClue", () => {
  it("shows a controlled error when the static image cannot load", () => {
    render(
      <SatelliteClue
        alt="Satellite clue"
        errorLabel="Image unavailable"
        url="/clues/missing.webp"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Satellite clue" }));
    expect(screen.getByRole("alert").textContent).toBe("Image unavailable");
  });
});
