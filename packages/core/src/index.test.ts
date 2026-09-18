import { describe, expect, it } from "vitest";

import { APP_NAME, INTERNAL_SLUG, MILESTONES, REPOSITORY_NAME } from "./index";

describe("project identity", () => {
  it("keeps display, internal, and repository names independent", () => {
    expect(APP_NAME).toBe("GEOLUKITUKI");
    expect(INTERNAL_SLUG).toBe("golukituki");
    expect(REPOSITORY_NAME).toBe("location-guessing-game");
  });

  it("defines the agreed delivery milestones", () => {
    expect(MILESTONES).toEqual(["M0", "M1", "M2", "M3", "M4"]);
  });
});
