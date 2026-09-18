import { describe, expect, it } from "vitest";

import {
  APP_NAME,
  calculateRoundPoints,
  createGameRequestSchema,
  haversineDistanceKm,
  INTERNAL_SLUG,
  MILESTONES,
  nicknameSchema,
  REPOSITORY_NAME,
  scoreScaleKm,
} from "./index";

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

describe("nickname validation", () => {
  it("normalizes Unicode and accepts a two-character Hangul nickname", () => {
    expect(nicknameSchema.parse("  \u1106\u1175\u11AB\u1109\u116E  ")).toBe(
      "민수",
    );
  });

  it("rejects repeated whitespace and unsupported punctuation", () => {
    expect(nicknameSchema.safeParse("Geo  Player").success).toBe(false);
    expect(nicknameSchema.safeParse("Geo<script>").success).toBe(false);
  });

  it("parses the create-game contract", () => {
    const turnstileToken = "test-token";
    expect(
      createGameRequestSchema.parse({
        nickname: "Kjubig",
        mode: "satellite",
        turnstileToken,
      }),
    ).toEqual({ nickname: "Kjubig", mode: "satellite", turnstileToken });
    expect(
      createGameRequestSchema.parse({
        nickname: "Kjubig",
        mode: "metro",
        turnstileToken,
      }),
    ).toEqual({ nickname: "Kjubig", mode: "metro", turnstileToken });
    expect(
      createGameRequestSchema.safeParse({
        nickname: "Kjubig",
        mode: "metro",
        turnstileToken: "x".repeat(2_049),
      }).success,
    ).toBe(false);
  });
});

describe("satellite scoring", () => {
  it("calculates haversine distance for known coordinates", () => {
    const distance = haversineDistanceKm(
      { latitude: 37.5665, longitude: 126.978 },
      { latitude: 35.1796, longitude: 129.0756 },
    );
    expect(distance).toBeGreaterThan(320);
    expect(distance).toBeLessThan(330);
  });

  it("awards 5000 points at the answer and decays exponentially", () => {
    expect(calculateRoundPoints(0)).toBe(5_000);
    expect(calculateRoundPoints(50)).toBe(1_839);
    expect(calculateRoundPoints(100)).toBe(677);
  });

  it("rejects invalid scoring input", () => {
    expect(() => calculateRoundPoints(-1)).toThrow(RangeError);
    expect(() => calculateRoundPoints(1, 0)).toThrow(RangeError);
  });

  it("uses a tighter distance scale for metro rounds", () => {
    expect(scoreScaleKm("satellite")).toBe(50);
    expect(scoreScaleKm("metro")).toBe(8);
    expect(calculateRoundPoints(8, scoreScaleKm("metro"))).toBe(1_839);
  });
});
