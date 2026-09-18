import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  Marker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import type { Coordinate, GameMode, RoundResult } from "@golukituki/core";

import { createGuessMapStyle } from "./guessMapStyle";

interface GuessMapProps {
  disabled?: boolean;
  expanded?: boolean;
  label?: string;
  mode: GameMode;
  onSelect?: (coordinate: Coordinate) => void;
  result?: RoundResult;
  selectCenterLabel?: string;
  selected?: Coordinate;
}

export function GuessMap({
  disabled,
  expanded,
  label = "Mapa zgadywania",
  mode,
  onSelect,
  result,
  selectCenterLabel = "Wybierz środek mapy",
  selected,
}: GuessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>(null);
  const markersRef = useRef<Marker[]>([]);
  const disabledRef = useRef(disabled);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    disabledRef.current = disabled;
    onSelectRef.current = onSelect;
  }, [disabled, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const frame = window.requestAnimationFrame(() => map.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [127.7, 36.25],
      zoom: 5.4,
      minZoom: 5,
      maxZoom: 12,
      style: createGuessMapStyle(mode),
      attributionControl: false,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(new maplibregl.AttributionControl({ compact: false }));
    map.on("click", (event: MapMouseEvent) => {
      if (!disabledRef.current) {
        onSelectRef.current?.({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
        });
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const addMarker = (coordinate: Coordinate, className: string) => {
      const element = document.createElement("div");
      element.className = `guess-marker ${className}`;
      markersRef.current.push(
        new maplibregl.Marker({ element })
          .setLngLat([coordinate.longitude, coordinate.latitude])
          .addTo(map),
      );
    };

    if (result) {
      addMarker(result.guess, "guess-marker--guess");
      addMarker(result.answer, "guess-marker--answer");
      const renderResult = () => {
        const line = {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [result.guess.longitude, result.guess.latitude],
              [result.answer.longitude, result.answer.latitude],
            ],
          },
        };
        const source = map.getSource<GeoJSONSource>("result-line");
        if (source) void source.setData(line);
        else {
          map.addSource("result-line", { type: "geojson", data: line });
          map.addLayer({
            id: "result-line",
            type: "line",
            source: "result-line",
            paint: {
              "line-color": "#e84f36",
              "line-dasharray": [2, 1.5],
              "line-width": 3,
            },
          });
        }
        const bounds = new maplibregl.LngLatBounds()
          .extend([result.guess.longitude, result.guess.latitude])
          .extend([result.answer.longitude, result.answer.latitude]);
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        map.fitBounds(bounds, {
          duration: reducedMotion ? 0 : 700,
          maxZoom: 8,
          padding: 90,
        });
      };
      if (map.loaded()) renderResult();
      else map.once("load", renderResult);
    } else if (selected) {
      addMarker(selected, "guess-marker--guess");
    } else {
      if (map.getLayer("result-line")) {
        map.removeLayer("result-line");
        map.removeSource("result-line");
      }
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      map.easeTo({
        center: [127.7, 36.25],
        zoom: 5.4,
        duration: reducedMotion ? 0 : 400,
      });
    }
  }, [result, selected]);

  const selectCenter = () => {
    const center = mapRef.current?.getCenter();
    if (!center || disabled) return;
    onSelect?.({ latitude: center.lat, longitude: center.lng });
  };

  return (
    <div className="map-frame">
      <div
        className="guess-map"
        ref={containerRef}
        aria-label={label}
        role="region"
      />
      {!disabled && (
        <button
          className="map-center-button"
          onClick={selectCenter}
          type="button"
        >
          {selectCenterLabel}
        </button>
      )}
    </div>
  );
}
