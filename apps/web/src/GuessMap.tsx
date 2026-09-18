import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, MapMouseEvent, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import type { Coordinate, RoundResult } from "@golukituki/core";

interface GuessMapProps {
  disabled?: boolean;
  onSelect?: (coordinate: Coordinate) => void;
  result?: RoundResult;
  selected?: Coordinate;
}

export function GuessMap({
  disabled,
  onSelect,
  result,
  selected,
}: GuessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [127.7, 36.25],
      zoom: 5.4,
      minZoom: 5,
      maxZoom: 12,
      style: {
        version: 8,
        sources: {
          korea: { type: "geojson", data: "/map/south-korea.geojson" },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#dce8df" },
          },
          {
            id: "korea-fill",
            type: "fill",
            source: "korea",
            paint: { "fill-color": "#f5f1e7", "fill-opacity": 1 },
          },
          {
            id: "korea-outline",
            type: "line",
            source: "korea",
            paint: { "line-color": "#1f573f", "line-width": 1.5 },
          },
        ],
      },
      attributionControl: false,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ customAttribution: "Natural Earth" }),
    );
    map.on("click", (event: MapMouseEvent) => {
      if (!disabled) {
        onSelect?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [disabled, onSelect]);

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
    } else if (selected) {
      addMarker(selected, "guess-marker--guess");
    }
  }, [result, selected]);

  return (
    <div
      className="guess-map"
      ref={containerRef}
      aria-label="Mapa zgadywania"
    />
  );
}
