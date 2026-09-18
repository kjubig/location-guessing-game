import { APP_NAME, type HealthResponse } from "@golukituki/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type ApiState = "checking" | "offline" | "online";
type Theme = "dark" | "light";

const architecture = ["browser", "worker", "database"] as const;
const modes = ["satellite", "metro"] as const;

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function App() {
  const { i18n, t } = useTranslation();
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [environment, setEnvironment] = useState<string>();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/health`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Health endpoint is unavailable");
        return response.json() as Promise<HealthResponse>;
      })
      .then((health) => {
        setEnvironment(health.environment);
        setApiState("online");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setApiState("offline");
      });

    return () => controller.abort();
  }, []);

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language.startsWith("pl") ? "en" : "pl");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={APP_NAME}>
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>{APP_NAME}</span>
        </a>
        <div className="toolbar">
          <button
            className="icon-button"
            type="button"
            onClick={toggleLanguage}
          >
            {t("language")}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={t("theme")}
            onClick={() =>
              setTheme((current) => (current === "light" ? "dark" : "light"))
            }
          >
            <span aria-hidden="true">{theme === "light" ? "◐" : "◑"}</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 id="hero-title">{t("title")}</h1>
            <p className="hero-description">{t("description")}</p>
          </div>

          <aside className="status-card" aria-live="polite">
            <div className="status-orbit" aria-hidden="true">
              <span className="orbit-dot" />
              <span className="orbit-center">M0</span>
            </div>
            <div>
              <p className="card-kicker">{t("statusTitle")}</p>
              <p>{t("statusDescription")}</p>
              <div className={`api-status api-status--${apiState}`}>
                <span className="status-dot" aria-hidden="true" />
                {t(`api${apiState[0]?.toUpperCase()}${apiState.slice(1)}`)}
                {environment ? ` · ${environment}` : ""}
              </div>
            </div>
          </aside>
        </section>

        <section className="section" aria-labelledby="flow-title">
          <div className="section-heading">
            <span>ARCHITECTURE</span>
            <h2 id="flow-title">{t("flowTitle")}</h2>
          </div>
          <div className="flow-grid">
            {architecture.map((item, index) => (
              <article className="flow-card" key={item}>
                <div className="flow-icon" aria-hidden="true">
                  {index === 0 ? "⌁" : index === 1 ? "↯" : "◫"}
                </div>
                <h3>{t(`${item}Title`)}</h3>
                <p>{t(`${item}Text`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="section modes-section"
          aria-labelledby="modes-title"
        >
          <div className="section-heading">
            <span>GAME MODES</span>
            <h2 id="modes-title">{t("modesTitle")}</h2>
          </div>
          <div className="modes-grid">
            {modes.map((mode, index) => (
              <article className={`mode-card mode-card--${mode}`} key={mode}>
                <span className="mode-number">0{index + 1}</span>
                <div>
                  <h3>{t(mode)}</h3>
                  <p>{t(`${mode}Text`)}</p>
                </div>
                <span className="mode-arrow" aria-hidden="true">
                  ↗
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <span>{t("footer")}</span>
        <span className="footer-docs">{t("docs")}</span>
      </footer>
    </div>
  );
}
