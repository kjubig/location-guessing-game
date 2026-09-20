import { describe, expect, it } from "vitest";

import { createGuessMapStyle } from "./guessMapStyle";

describe("guess map styles", () => {
  it("keeps satellite rounds free from geographic hints", () => {
    const style = createGuessMapStyle("satellite", "https://example.test");

    expect(style.sources).not.toHaveProperty("satellite-context");
    expect(style.sources).not.toHaveProperty("korea");
    expect(style.layers.map((layer) => layer.id)).toEqual(["background"]);
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

  it("keeps a root-relative data URL for the metro outline", () => {
    expect(createGuessMapStyle("metro").sources.korea).toMatchObject({
      data: "/map/south-korea.geojson",
    });
  });
});
