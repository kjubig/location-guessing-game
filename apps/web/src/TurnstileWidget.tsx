import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "cloudflare-turnstile-script";
const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const OFFICIAL_TEST_SITE_KEY = "1x00000000000000000000AA";

export interface TurnstileRenderOptions {
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  sitekey: string;
  theme: "auto";
}

export interface TurnstileApi {
  remove(widgetId: string): void;
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  errorLabel: string;
  loadingLabel: string;
  onToken: (token: string | undefined) => void;
}

function configuredSiteKey(): string | undefined {
  const environmentSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  return (
    environmentSiteKey ||
    (import.meta.env.DEV ? OFFICIAL_TEST_SITE_KEY : undefined)
  );
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(
    SCRIPT_ID,
  ) as HTMLScriptElement | null;
  const script = existing ?? document.createElement("script");

  return new Promise((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Turnstile load failed")),
      {
        once: true,
      },
    );
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });
}

export function TurnstileWidget({
  errorLabel,
  loadingLabel,
  onToken,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sitekey = configuredSiteKey();
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    sitekey ? "loading" : "error",
  );

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | undefined;

    if (!sitekey) return;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          callback: (token) => {
            setStatus("ready");
            onToken(token);
          },
          "error-callback": () => {
            setStatus("error");
            onToken(undefined);
          },
          "expired-callback": () => {
            setStatus("loading");
            onToken(undefined);
          },
          sitekey,
          theme: "auto",
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken, sitekey]);

  return (
    <div className="turnstile">
      <div ref={containerRef} />
      {status === "loading" && <small>{loadingLabel}</small>}
      {status === "error" && (
        <small className="form-error" role="alert">
          {errorLabel}
        </small>
      )}
    </div>
  );
}
