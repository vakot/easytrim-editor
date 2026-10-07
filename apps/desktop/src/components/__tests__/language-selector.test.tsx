import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GB from "country-flag-icons/react/3x2/GB";
import RU from "country-flag-icons/react/3x2/RU";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import { SUPPORTED_LANGUAGES } from "@/domain/languages";
import { translationCoverage } from "@/i18n/resources";

const languages = SUPPORTED_LANGUAGES;

describe("LanguageSelector", () => {
  it("passes custom classes when wrapping submenu content", () => {
    render(
      <LanguageSelector>
        <LanguageSelectorContent asChild className="custom-submenu-content">
          <div data-testid="submenu-content" />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    expect(screen.getByTestId("submenu-content")).toHaveClass("custom-submenu-content");
  });

  it("filters by language names, selects by keyboard, and displays the selected flag and language", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <LanguageSelector defaultValue="ru" languages={languages} onValueChange={onValueChange}>
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" placeholder="Search languages" />
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const trigger = screen.getByRole("button", { name: "Choose language" });
    expect(trigger).toHaveTextContent("Русский");
    expect(trigger).not.toHaveTextContent("76%");
    expect(trigger.querySelector("span[aria-hidden='true'] svg")?.outerHTML).toBe(
      renderToStaticMarkup(<RU aria-hidden="true" className="block h-auto! w-full!" />),
    );
    expect(trigger.querySelector("span[aria-hidden='true']")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /choose language/i }));
    const search = screen.getByRole("combobox", { name: "Search languages" });
    await user.type(search, "Русский");

    expect(screen.getByRole("option", { name: "Русский, ru" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "English, en" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("ru");
    expect(screen.getByRole("button", { name: "Choose language" })).toHaveTextContent("Русский");
    expect(
      screen
        .getByRole("button", { name: "Choose language" })
        .querySelector("span[aria-hidden='true'] svg")?.outerHTML,
    ).toBe(renderToStaticMarkup(<RU aria-hidden="true" className="block h-auto! w-full!" />));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("finds Russian by both its English and native names", async () => {
    const user = userEvent.setup();

    render(
      <LanguageSelector defaultOpen languages={languages}>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" />
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const search = screen.getByRole("combobox", { name: "Search languages" });
    await user.type(search, "Russian");
    expect(screen.getByRole("option", { name: "Русский, ru" })).toBeVisible();
    await user.clear(search);
    await user.type(search, "Русский");
    expect(screen.getByRole("option", { name: "Русский, ru" })).toBeVisible();
  });

  it("uses the editable input as the trigger and restores the selected name after closing", async () => {
    const user = userEvent.setup();

    render(
      <LanguageSelector defaultValue="en" label="Choose language" languages={languages}>
        <LanguageSelectorInput aria-label="Choose language" placeholder="Search languages" />
        <LanguageSelectorContent>
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const input = screen.getByRole("combobox", { name: "Choose language" });
    expect(input).toHaveValue("English");

    fireEvent.pointerDown(input, { button: 0 });
    fireEvent.focus(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.pointerUp(input, { button: 0 });
    fireEvent.click(input);
    expect(screen.getByRole("listbox")).toBeVisible();
    await user.type(input, "russan");
    expect(input).toHaveValue("russan");
    expect(screen.getByRole("option", { name: "Русский, ru" })).toBeVisible();

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(input).toHaveValue("Русский"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps a disabled selector closed", async () => {
    const user = userEvent.setup();

    render(
      <LanguageSelector disabled languages={languages}>
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" />
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const trigger = screen.getByRole("button", { name: "Choose language" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the empty state for an unmatched query and resets search when dismissed", async () => {
    const user = userEvent.setup();

    render(
      <LanguageSelector languages={languages}>
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" />
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    await user.click(screen.getByRole("button", { name: "Choose language" }));
    await user.type(screen.getByRole("combobox", { name: "Search languages" }), "unknown");
    expect(screen.getByText("No languages found")).toBeVisible();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Choose language" }));

    expect(screen.getByRole("option", { name: "English, en" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Русский, ru" })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it.each([
    { Flag: GB, language: SUPPORTED_LANGUAGES[0] },
    { Flag: RU, language: SUPPORTED_LANGUAGES[1] },
  ])("renders the package flag in its option", ({ Flag, language }) => {
    const label = `${language.nativeName}, ${language.code}`;

    render(
      <LanguageSelector defaultOpen languages={[language]}>
        <LanguageSelectorContent>
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const option = screen.getByRole("option", { name: label });
    const flagContainer = option.querySelector("span[aria-hidden='true']");
    const flagSvg = flagContainer?.querySelector("svg");
    expect(flagContainer).toBeInTheDocument();
    expect(flagSvg?.outerHTML).toBe(
      renderToStaticMarkup(<Flag aria-hidden="true" className="block h-auto! w-full!" />),
    );
    const percentage = translationCoverage[language.code].percentage;
    expect(within(option).getByText(`${percentage}%`)).toBeVisible();
    expect(
      within(option).getByRole("progressbar", {
        name: `${language.nativeName} translation coverage: ${percentage}%`,
      }),
    ).toHaveAttribute("aria-valuenow", String(percentage));
    if (language.code !== "en") expect(option).not.toHaveTextContent(language.englishName);
    expect(option.querySelector(".col-start-3.row-start-1 svg.lucide-check")).toBeNull();
  });

  it("shows English coverage and a selection check only for the selected language", () => {
    render(
      <LanguageSelector defaultOpen defaultValue="en" languages={languages}>
        <LanguageSelectorContent>
          <LanguageSelectorList />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const english = screen.getByRole("option", { name: "English, en" });
    expect(within(english).getByText("100%")).toBeVisible();
    expect(translationCoverage.en.percentage).toBe(100);
    expect(english.querySelector(".col-start-3.row-start-1 svg.lucide-check")).toBeInTheDocument();

    for (const language of languages.filter(({ code }) => code !== "en")) {
      const option = screen.getByRole("option", {
        name: `${language.nativeName}, ${language.code}`,
      });

      expect(option.querySelector(".col-start-3.row-start-1 svg.lucide-check")).toBeNull();
    }
  });
});
