import { useEffect, useState } from "react";

interface MetroClueData {
  canvas: { height: number; width: number };
  lines: Array<{ points: Array<[number, number]> }>;
  schemaVersion: 1;
  stations: Array<[number, number]>;
}

interface MetroClueProps {
  errorLabel: string;
  label: string;
  loadingLabel: string;
  url: string;
}

function isPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => Number.isFinite(coordinate))
  );
}

function isMetroClue(value: unknown): value is MetroClueData {
  if (!value || typeof value !== "object") return false;
  const clue = value as Partial<MetroClueData>;
  return (
    clue.schemaVersion === 1 &&
    Number.isFinite(clue.canvas?.width) &&
    Number.isFinite(clue.canvas?.height) &&
    Array.isArray(clue.lines) &&
    clue.lines.length > 0 &&
    clue.lines.every(
      (line) =>
        Array.isArray(line.points) &&
        line.points.length >= 2 &&
        line.points.every(isPoint),
    ) &&
    Array.isArray(clue.stations) &&
    clue.stations.every(isPoint)
  );
}

export function MetroClue({
  errorLabel,
  label,
  loadingLabel,
  url,
}: MetroClueProps) {
  const [loadState, setLoadState] = useState<{
    clue?: MetroClueData;
    failed?: boolean;
    url: string;
  }>();
  const current = loadState?.url === url ? loadState : undefined;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Metro clue HTTP ${response.status}`);
        const value: unknown = await response.json();
        if (!isMetroClue(value)) throw new Error("Invalid metro clue");
        setLoadState({ clue: value, url });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setLoadState({ failed: true, url });
        }
      });
    return () => controller.abort();
  }, [url]);

  if (current?.failed) {
    return <div className="metro-clue metro-clue--status">{errorLabel}</div>;
  }
  if (!current?.clue) {
    return <div className="metro-clue metro-clue--status">{loadingLabel}</div>;
  }

  return (
    <div className="metro-clue">
      <svg
        aria-label={label}
        role="img"
        viewBox={`0 0 ${current.clue.canvas.width} ${current.clue.canvas.height}`}
      >
        <rect
          className="metro-clue__background"
          width={current.clue.canvas.width}
          height={current.clue.canvas.height}
        />
        <g className="metro-clue__lines">
          {current.clue.lines.map((line, index) => (
            <polyline
              key={`${index}-${line.points.length}`}
              points={line.points.map((point) => point.join(",")).join(" ")}
            />
          ))}
        </g>
        <g className="metro-clue__stations">
          {current.clue.stations.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="8" />
          ))}
        </g>
      </svg>
    </div>
  );
}
