import type { StyleSpecification } from "maplibre-gl";

import type { GameMode } from "@golukituki/core";

const NATURAL_EARTH_ATTRIBUTION =
  '<a href="https://www.naturalearthdata.com/">Natural Earth</a>';

const EOX_CLOUDLESS_ATTRIBUTION =
  '<a href="https://cloudless.eox.at/">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)';

const EOX_CLOUDLESS_TILES =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg";

export function createGuessMapStyle(
  mode: GameMode,
  assetOrigin?: string,
): StyleSpecification {
  const satelliteContext = mode === "metro";
  const koreaDataUrl = assetOrigin
    ? new URL("/map/south-korea.geojson", assetOrigin).href
    : "/map/south-korea.geojson";

  return {
    version: 8,
    sources: {
      ...(satelliteContext
        ? {
            korea: {
              type: "geojson" as const,
              data: koreaDataUrl,
              attribution: NATURAL_EARTH_ATTRIBUTION,
            },
          }
        : {}),
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
          "background-color": satelliteContext ? "#12201c" : "#a9c9c7",
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
            {
              id: "korea-outline",
              type: "line" as const,
              source: "korea",
              paint: {
                "line-color": "#e8f0e8",
                "line-opacity": 0.55,
                "line-width": 1,
              },
            },
          ]
        : []),
    ],
  };
}
