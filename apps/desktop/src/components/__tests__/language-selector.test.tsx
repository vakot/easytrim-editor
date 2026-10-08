import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorFlag,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
} from "@/components/language-selector";
import { SUPPORTED_LANGUAGES } from "@/domain/languages";

const languages = SUPPORTED_LANGUAGES;

describe("LanguageSelector", () => {
  it("passes custom classes when wrapping submenu content", () => {
    render(
      <LanguageSelector label="Search languages" languages={languages}>
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
      <LanguageSelector
        defaultValue="ru"
        label="Search languages"
        languages={languages}
        onValueChange={onValueChange}
      >
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" placeholder="Search languages…" />
          <LanguageSelectorList emptyState="No languages found" />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const trigger = screen.getByRole("button", { name: "Choose language" });
    expect(trigger).toHaveTextContent("Русский");
    expect(trigger).not.toHaveTextContent("76%");
    expect(trigger.querySelector("span[aria-hidden='true']")).toHaveTextContent("🇷🇺");
    expect(trigger.querySelector("span[aria-hidden='true']")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /choose language/i }));
    const search = screen.getByRole("combobox", { name: "Search languages" });
    await user.type(search, "Русский");

    expect(screen.getByRole("option", { name: "Русский (Russian), ru" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "English, en" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("ru");
    expect(screen.getByRole("button", { name: "Choose language" })).toHaveTextContent(
      "Русский (Russian)",
    );
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("finds Russian by both its English and native names", async () => {
    const user = userEvent.setup();

    render(
      <LanguageSelector defaultOpen label="Search languages" languages={languages}>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" />
          <LanguageSelectorList emptyState="No languages found" />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const search = screen.getByRole("combobox", { name: "Search languages" });
    await user.type(search, "Russian");
    expect(screen.getByRole("option", { name: "Русский (Russian), ru" })).toBeVisible();
    await user.clear(search);
    await user.type(search, "Русский");
    expect(screen.getByRole("option", { name: "Русский (Russian), ru" })).toBeVisible();
  });

  it("uses the editable input as the trigger and restores the selected name after closing", async () => {
    const user = userEvent.setup();

    render(
      <LanguageSelector defaultValue="en" label="Choose language" languages={languages}>
        <LanguageSelectorInput aria-label="Choose language" placeholder="Search languages…" />
        <LanguageSelectorContent>
          <LanguageSelectorList emptyState="No languages found" />
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
      <LanguageSelector disabled label="Search languages" languages={languages}>
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" />
          <LanguageSelectorList emptyState="No languages found" />
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
      <LanguageSelector label="Search languages" languages={languages}>
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search languages" />
          <LanguageSelectorList emptyState="No languages found" />
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
    expect(screen.getByRole("option", { name: "Русский (Russian), ru" })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("renders a flag, display name, and selection state without settings coverage", () => {
    render(
      <LanguageSelector
        defaultOpen
        defaultValue="ru"
        label="Search languages"
        languages={languages}
      >
        <LanguageSelectorContent>
          <LanguageSelectorList emptyState="No languages found" />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const russian = screen.getByRole("option", { name: "Русский (Russian), ru" });
    expect(russian).toHaveTextContent("🇷🇺");
    expect(russian.querySelector(".col-start-3.row-start-1 svg.lucide-check")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("accepts a consumer language dataset and custom option composition", () => {
    const audioLanguage = {
      code: "de",
      englishName: "German",
      nativeName: "Deutsch",
      region: "DE",
    };

    render(
      <LanguageSelector defaultOpen label="Search audio languages" languages={[audioLanguage]}>
        <LanguageSelectorContent>
          <LanguageSelectorList
            emptyState="No audio languages found"
            renderOption={(language, { displayName }) => (
              <>
                <LanguageSelectorFlag className="col-start-1 row-start-1" language={language} />
                <span className="col-start-2 row-start-1">{displayName} · metadata</span>
              </>
            )}
          />
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const option = screen.getByRole("option", { name: "Deutsch (German), de" });
    expect(option).toHaveTextContent("Deutsch (German) · metadata");
    expect(option).toHaveTextContent("🇩🇪");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
