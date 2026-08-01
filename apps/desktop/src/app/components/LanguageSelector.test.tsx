import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/i18n/config";
import { LanguageSelector } from "./LanguageSelector";

describe("LanguageSelector", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("changes the runtime language without persisting configuration", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    render(<LanguageSelector className="w-36" />);

    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(screen.getByRole("option", { name: "Slovenčina" }));

    expect(i18n.resolvedLanguage).toBe("sk");
    expect(document.documentElement.lang).toBe("sk");
    expect(localStorage.getItem("i18nextLng")).toBeNull();
  });
});
