import { describe, expect, it } from "vitest";

import { createGuessMapStyle } from "./guessMapStyle";

describe("guess map styles", () => {
  it("keeps satellite rounds free from geographic hints", () => {
    const style = createGuessMapStyle("satellite");

    expect(style.sources).not.toHaveProperty("satellite-context");
    expect(style.layers.map((layer) => layer.id)).toEqual([
      "background",
      "korea-fill",
      "korea-outline",
    ]);
  });

  it("uses satellite terrain only for metro rounds", () => {
    const style = createGuessMapStyle("metro");
    const source = style.sources["satellite-context"];

    expect(source).toMatchObject({
      type: "raster",
      maxzoom: 14,
      tileSize: 256,
    });
    expect(style.layers.map((layer) => layer.id)).toEqual([
      "background",
      "satellite-context",
      "korea-outline",
    ]);
    expect(JSON.stringify(source)).toContain("EOxCloudless");
  });
});
