import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GB from "country-flag-icons/react/3x2/GB";
import RU from "country-flag-icons/react/3x2/RU";
import SK from "country-flag-icons/react/3x2/SK";
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
import { getLanguageDisplayName, SUPPORTED_LANGUAGES } from "@/domain/languages";

const languages = SUPPORTED_LANGUAGES;

describe("LanguageSelector", () => {
  it("applies content sizing classes when wrapping custom submenu content", () => {
    render(
      <LanguageSelector>
        <LanguageSelectorContent asChild className="custom-submenu-content">
          <div data-testid="submenu-content" />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    expect(screen.getByTestId("submenu-content")).toHaveClass(
      "w-[max(var(--radix-popover-trigger-width,16rem),16rem)]",
      "max-w-[min(24rem,calc(100vw-2rem))]",
      "min-w-[min(16rem,calc(100vw-2rem))]",
      "custom-submenu-content",
    );
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
    expect(trigger).toHaveTextContent("Русский (Russian)");
    expect(trigger.querySelector("span[aria-hidden='true'] svg")?.outerHTML).toBe(
      renderToStaticMarkup(<RU aria-hidden="true" className="block h-auto w-full" />),
    );
    expect(trigger.querySelector("span[aria-hidden='true']")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /choose language/i }));
    const search = screen.getByRole("combobox", { name: "Search languages" });
    await user.type(search, "slovencina");

    expect(screen.getByRole("option", { name: "Slovenčina (Slovak), sk" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Русский (Russian), ru" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("sk");
    expect(screen.getByRole("button", { name: "Choose language" })).toHaveTextContent(
      "Slovenčina (Slovak)",
    );
    expect(
      screen
        .getByRole("button", { name: "Choose language" })
        .querySelector("span[aria-hidden='true'] svg")?.outerHTML,
    ).toBe(renderToStaticMarkup(<SK aria-hidden="true" className="block h-auto w-full" />));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
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
    expect(screen.getByRole("option", { name: "Русский (Russian), ru" })).toBeVisible();

    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(input).toHaveValue("Русский (Russian)"));
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
    expect(screen.getByText("No languages found.")).toBeVisible();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Choose language" }));

    expect(screen.getByRole("option", { name: "English, en" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Русский (Russian), ru" })).toBeVisible();
  });

  it.each([
    { Flag: GB, language: SUPPORTED_LANGUAGES[0] },
    { Flag: RU, language: SUPPORTED_LANGUAGES[1] },
    { Flag: SK, language: SUPPORTED_LANGUAGES[2] },
  ])("renders the package flag in its option", ({ Flag, language }) => {
    const label = `${getLanguageDisplayName(language)}, ${language.code}`;

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
      renderToStaticMarkup(<Flag aria-hidden="true" className="block h-auto w-full" />),
    );
    expect(within(option).getByText(language.code)).toBeVisible();
  });
});
