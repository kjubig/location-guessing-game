import { useState } from "react";

interface SatelliteClueProps {
  alt: string;
  errorLabel: string;
  url: string;
}

export function SatelliteClue({ alt, errorLabel, url }: SatelliteClueProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="clue-image clue-image--status" role="alert">
        {errorLabel}
      </div>
    );
  }

  return (
    <img
      className="clue-image"
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
