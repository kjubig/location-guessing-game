import type { StyleSpecification } from "maplibre-gl";

import type { GameMode } from "@golukituki/core";

const NATURAL_EARTH_ATTRIBUTION =
  '<a href="https://www.naturalearthdata.com/">Natural Earth</a>';

const EOX_CLOUDLESS_ATTRIBUTION =
  '<a href="https://cloudless.eox.at/">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)';

const EOX_CLOUDLESS_TILES =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg";

export function createGuessMapStyle(mode: GameMode): StyleSpecification {
  const satelliteContext = mode === "metro";

  return {
    version: 8,
    sources: {
      korea: {
        type: "geojson",
        data: "/map/south-korea.geojson",
        attribution: NATURAL_EARTH_ATTRIBUTION,
      },
      ...(satelliteContext
        ? {
            "satellite-context": {
              type: "raster" as const,
              tiles: [EOX_CLOUDLESS_TILES],
              tileSize: 256,
              maxzoom: 14,
              attribution: EOX_CLOUDLESS_ATTRIBUTION,
            },
          }
        : {}),
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": satelliteContext ? "#12201c" : "#dce8df",
        },
      },
      ...(satelliteContext
        ? [
            {
              id: "satellite-context",
              type: "raster" as const,
              source: "satellite-context",
              paint: {
                "raster-saturation": -0.12,
                "raster-contrast": 0.08,
              },
            },
          ]
        : [
            {
              id: "korea-fill",
              type: "fill" as const,
              source: "korea",
              paint: { "fill-color": "#f5f1e7", "fill-opacity": 1 },
            },
          ]),
      {
        id: "korea-outline",
        type: "line",
        source: "korea",
        paint: {
          "line-color": satelliteContext ? "#e8f0e8" : "#1f573f",
          "line-opacity": satelliteContext ? 0.55 : 1,
          "line-width": satelliteContext ? 1 : 1.5,
        },
      },
    ],
  };
}
