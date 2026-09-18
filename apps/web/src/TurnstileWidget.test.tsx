import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type TurnstileApi,
  type TurnstileRenderOptions,
  TurnstileWidget,
} from "./TurnstileWidget";

afterEach(() => {
  cleanup();
  delete window.turnstile;
  vi.restoreAllMocks();
});

describe("TurnstileWidget", () => {
  it("passes the browser token to the game form", async () => {
    const onToken = vi.fn();
    const turnstile: TurnstileApi = {
      remove: vi.fn(),
      render: vi.fn(
        (_container: HTMLElement, options: TurnstileRenderOptions) => {
          options.callback("verified-token");
          return "widget-1";
        },
      ),
    };
    window.turnstile = turnstile;

    render(
      <TurnstileWidget
        errorLabel="Verification failed"
        loadingLabel="Verification loading"
        onToken={onToken}
      />,
    );

    await waitFor(() => expect(onToken).toHaveBeenCalledWith("verified-token"));
    expect(screen.queryByText("Verification failed")).toBeNull();
  });
});
