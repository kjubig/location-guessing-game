import { afterEach, describe, expect, it } from "vitest";

import i18n from "./i18n";

afterEach(async () => {
  await i18n.changeLanguage("pl");
});

describe("translations", () => {
  it("starts with Polish product copy", () => {
    expect(i18n.language).toBe("pl");
    expect(i18n.t("statusTitle")).toBe("Fundament M0");
    expect(i18n.t("nicknamePlaceholder")).toBe("np. karciaczek");
  });

  it("contains the matching English catalog", async () => {
    await i18n.changeLanguage("en");

    expect(i18n.t("statusTitle")).toBe("M0 foundation");
    expect(i18n.t("nicknamePlaceholder")).toBe("e.g. karciaczek");
  });
});
