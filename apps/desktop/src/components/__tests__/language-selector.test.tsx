import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorEmpty,
  LanguageSelectorGroup,
  LanguageSelectorInput,
  LanguageSelectorItem,
  LanguageSelectorItemFlag,
  LanguageSelectorItemIndicator,
  LanguageSelectorItemText,
  LanguageSelectorList,
  LanguageSelectorOptions,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
  useLanguageSelectorOptions,
} from "@/components/language-selector";
import { AUDIO_METADATA_LANGUAGES, SUPPORTED_LANGUAGES } from "@/domain/languages";

const languages = SUPPORTED_LANGUAGES;

function LanguageResults({ message }: { message: string }) {
  return (
    <>
      <LanguageSelectorEmpty>{message}</LanguageSelectorEmpty>
      <LanguageSelectorOptions />
    </>
  );
}

function CustomLanguageOptions() {
  const options = useLanguageSelectorOptions();

  return options.map((language) => (
    <LanguageSelectorItem key={language.code} value={language.code}>
      <LanguageSelectorItemFlag />
      <LanguageSelectorItemText>
        <span> · metadata</span>
      </LanguageSelectorItemText>
      <LanguageSelectorItemIndicator />
    </LanguageSelectorItem>
  ));
}

describe("LanguageSelector", () => {
  it("uses defaultValue as the initial uncontrolled selection", () => {
    render(
      <LanguageSelector defaultValue="ru" label="Search languages" languages={languages}>
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
      </LanguageSelector>,
    );

    expect(screen.getByRole("button", { name: "Choose language" })).toHaveTextContent(
      "Русский (Russian)",
    );
  });

  it("distinguishes a controlled selection from an explicitly empty value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const renderSelector = (value: string | null) => (
      <LanguageSelector
        defaultValue="ru"
        label="Search languages"
        languages={languages}
        onValueChange={onValueChange}
        value={value}
      >
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorList>
            <LanguageSelectorOptions />
          </LanguageSelectorList>
        </LanguageSelectorContent>
      </LanguageSelector>
    );

    const { rerender } = render(renderSelector("en"));
    const trigger = screen.getByRole("button", { name: "Choose language" });
    expect(trigger).toHaveTextContent("English");

    rerender(renderSelector(null));
    expect(trigger).toHaveTextContent("Select language");
    expect(trigger).not.toHaveTextContent("Русский");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Русский (Russian), ru" }));

    expect(onValueChange).toHaveBeenCalledWith("ru");
    expect(trigger).toHaveTextContent("Select language");

    rerender(renderSelector("ru"));
    expect(trigger).toHaveTextContent("Русский (Russian)");
  });

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
          <LanguageSelectorList>
            <LanguageResults message="No languages found" />
          </LanguageSelectorList>
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const trigger = screen.getByRole("button", { name: "Choose language" });
    expect(trigger).toHaveTextContent("Русский");
    expect(trigger).not.toHaveTextContent("76%");
    expect(trigger.querySelector("span[aria-hidden='true'] svg")).toBeInTheDocument();

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
          <LanguageSelectorList>
            <LanguageResults message="No languages found" />
          </LanguageSelectorList>
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
          <LanguageSelectorList>
            <LanguageResults message="No languages found" />
          </LanguageSelectorList>
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
          <LanguageSelectorList>
            <LanguageResults message="No languages found" />
          </LanguageSelectorList>
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
          <LanguageSelectorList>
            <LanguageResults message="No languages found" />
          </LanguageSelectorList>
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
          <LanguageSelectorList>
            <LanguageResults message="No languages found" />
          </LanguageSelectorList>
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const russian = screen.getByRole("option", { name: "Русский (Russian), ru" });
    expect(russian.querySelector("span[aria-hidden='true'] svg")).toBeInTheDocument();
    expect(russian.querySelector(".col-start-3.row-start-1 svg.lucide-check")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("supports custom item composition using the filtered options hook", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const audioLanguage = {
      code: "de",
      englishName: "German",
      nativeName: "Deutsch",
      region: "DE",
    };

    const anotherAudioLanguage = {
      code: "ja",
      englishName: "Japanese",
      nativeName: "日本語",
      region: "JP",
    };

    render(
      <LanguageSelector
        defaultOpen
        label="Search audio languages"
        languages={[audioLanguage, anotherAudioLanguage]}
        onValueChange={onValueChange}
      >
        <LanguageSelectorContent>
          <LanguageSelectorInput aria-label="Search audio languages" />
          <LanguageSelectorList>
            <LanguageSelectorEmpty>No audio languages found</LanguageSelectorEmpty>
            <LanguageSelectorGroup>
              <CustomLanguageOptions />
            </LanguageSelectorGroup>
          </LanguageSelectorList>
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const option = screen.getByRole("option", { name: "Deutsch (German), de" });
    expect(option).toHaveTextContent("Deutsch (German) · metadata");
    expect(option.querySelector("span[aria-hidden='true'] svg")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "日本語 (Japanese), ja" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await user.type(screen.getByRole("combobox", { name: "Search audio languages" }), "German");

    expect(screen.getByRole("option", { name: "Deutsch (German), de" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "日本語 (Japanese), ja" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Deutsch (German), de" }));
    expect(onValueChange).toHaveBeenCalledWith("de");
  });

  it("renders SVG flags for audio language options and the selected value", () => {
    const selectedLanguage = AUDIO_METADATA_LANGUAGES.find(({ code }) => code === "ja");
    if (!selectedLanguage) throw new Error("Japanese audio metadata language is missing");

    render(
      <LanguageSelector
        defaultOpen
        defaultValue={selectedLanguage.code}
        label="Search audio languages"
        languages={AUDIO_METADATA_LANGUAGES}
      >
        <LanguageSelectorTrigger>
          <button aria-label="Choose language" type="button">
            <LanguageSelectorValue placeholder="Select language" />
          </button>
        </LanguageSelectorTrigger>
        <LanguageSelectorContent>
          <LanguageSelectorList>
            <LanguageResults message="No audio languages found" />
          </LanguageSelectorList>
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const selectedValue = screen.getByRole("button", { name: "Choose language" });
    expect(selectedValue.querySelector("span[aria-hidden='true'] svg")).toBeInTheDocument();
    expect(selectedValue).not.toHaveTextContent("JP");

    for (const language of AUDIO_METADATA_LANGUAGES) {
      const displayName =
        language.nativeName === language.englishName
          ? language.nativeName
          : `${language.nativeName} (${language.englishName})`;

      const option = screen.getByRole("option", {
        name: `${displayName}, ${language.code}`,
      });

      expect(option.querySelector("span[aria-hidden='true'] svg")).toBeInTheDocument();
      expect(option).not.toHaveTextContent(language.region);
    }
  });

  it("renders no flag for malformed regions without throwing", () => {
    const unknownLanguage = {
      code: "xx",
      englishName: "Unknown",
      nativeName: "Unknown",
      region: "X",
    };

    render(
      <LanguageSelector defaultOpen label="Search languages" languages={[unknownLanguage]}>
        <LanguageSelectorContent>
          <LanguageSelectorList>
            <LanguageSelectorEmpty>No languages found</LanguageSelectorEmpty>
            <LanguageSelectorOptions />
          </LanguageSelectorList>
        </LanguageSelectorContent>
      </LanguageSelector>,
    );

    const option = screen.getByRole("option", { name: "Unknown, xx" });
    expect(option.querySelector("span[aria-hidden='true']")).toBeEmptyDOMElement();
  });
});
