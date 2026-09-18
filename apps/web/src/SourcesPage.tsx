import type { TFunction } from "i18next";

interface SourcesPageProps {
  onClose: () => void;
  t: TFunction;
}

const sources = [
  {
    name: "Copernicus Sentinel-2",
    url: "https://dataspace.copernicus.eu/terms-and-conditions",
    license: "Copernicus Sentinel Data Terms and Conditions",
  },
  {
    name: "Microsoft Planetary Computer",
    url: "https://planetarycomputer.microsoft.com/docs/quickstarts/using-the-data-api/",
    license: "STAC catalogue and rendering service",
  },
  {
    name: "OpenStreetMap",
    url: "https://www.openstreetmap.org/copyright",
    license: "© OpenStreetMap contributors · ODbL 1.0",
  },
  {
    name: "EOxCloudless 2025",
    url: "https://cloudless.eox.at/documentation/license",
    license: "Sentinel-2 cloudless · EOX IT Services GmbH · CC BY-NC-SA 4.0",
  },
  {
    name: "GeoNames",
    url: "https://www.geonames.org/export/",
    license: "City catalogue · CC BY 4.0",
  },
  {
    name: "Natural Earth",
    url: "https://www.naturalearthdata.com/about/terms-of-use/",
    license: "Country outline · public domain",
  },
] as const;

export function SourcesPage({ onClose, t }: SourcesPageProps) {
  return (
    <main className="sources-page">
      <p className="eyebrow">{t("sourcesEyebrow")}</p>
      <h1>{t("sourcesTitle")}</h1>
      <p className="sources-page__intro">{t("sourcesIntro")}</p>
      <div className="source-list">
        {sources.map((source) => (
          <article className="source-card" key={source.name}>
            <h2>{source.name}</h2>
            <p>{source.license}</p>
            <a href={source.url} rel="noreferrer" target="_blank">
              {t("sourceTerms")}
              <span aria-hidden="true"> ↗</span>
            </a>
          </article>
        ))}
      </div>
      <aside className="license-note">
        <h2>{t("applicationLicenseTitle")}</h2>
        <p>{t("applicationLicenseText")}</p>
      </aside>
      <button className="primary-button" onClick={onClose} type="button">
        {t("backToGame")}
      </button>
    </main>
  );
}
