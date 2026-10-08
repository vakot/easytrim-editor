import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n/config";
import { translationCoverage } from "@/i18n/resources";
import { openExternalUrl } from "@/lib/open-external-url.utils";

import { SettingsGeneral } from "../SettingsGeneral";

vi.mock("@/lib/open-external-url.utils", () => ({ openExternalUrl: vi.fn() }));

const TRANSLATION_GUIDE_URL =
  "https://github.com/vakot/easytrim-editor/blob/master/apps/desktop/src/i18n/README.md";

describe("SettingsGeneral", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.mocked(openExternalUrl).mockClear();
  });

  it("keeps the translation contribution action outside the selector and opens the guide", async () => {
    const user = userEvent.setup();
    render(<SettingsGeneral />);

    const helpTranslate = screen.getByRole("link", { name: "Help translate EasyTrim" });
    expect(helpTranslate).toHaveAttribute("href", TRANSLATION_GUIDE_URL);

    await user.click(screen.getByRole("button", { name: "Language" }));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText(`${translationCoverage.ru.percentage}%`)).toBeVisible();
    expect(within(listbox).getAllByRole("progressbar")).toHaveLength(2);
    expect(
      within(listbox)
        .getByRole("option", { name: "English, en" })
        .querySelector("span[aria-hidden='true'] svg"),
    ).toBeInTheDocument();
    expect(
      within(listbox)
        .getByRole("option", { name: "Русский (Russian), ru" })
        .querySelector("span[aria-hidden='true'] svg"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "Language" })
        .querySelector("span[aria-hidden='true'] svg"),
    ).toBeInTheDocument();
    expect(within(listbox).queryByRole("link", { name: "Help translate EasyTrim" })).toBeNull();
    expect(helpTranslate).toBeVisible();

    fireEvent.click(helpTranslate);
    expect(openExternalUrl).toHaveBeenCalledWith(TRANSLATION_GUIDE_URL);
  });

  it("continues to change the application language from the selector", async () => {
    const user = userEvent.setup();
    render(<SettingsGeneral />);

    await user.click(screen.getByRole("button", { name: "Language" }));
    const languageSearch = screen.getByRole("combobox", { name: "Search languages" });
    expect(languageSearch).toHaveAttribute("placeholder", "Search languages…");
    await user.type(languageSearch, "Русский");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(i18n.resolvedLanguage).toBe("ru"));
    expect(screen.getByRole("button", { name: "Язык" })).toHaveTextContent("Русский");

    await user.click(screen.getByRole("button", { name: "Язык" }));
    const russianSearch = screen.getByRole("combobox", { name: "Поиск языков" });
    expect(russianSearch).toHaveAttribute("placeholder", "Поиск языков…");
  });
});
