"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type AutocompleteProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  id: string;
  label: string;
  onValueChange: (value: string) => void;
  suggestions: string[];
  value: string;
};

function Autocomplete({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  id,
  label,
  onValueChange,
  suggestions,
  value,
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const filteredSuggestions = suggestions.filter((suggestion) =>
    suggestion.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()),
  );

  const selectSuggestion = (suggestion: string) => {
    onValueChange(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <Combobox label={label} onOpenChange={setOpen} open={open} shouldFilter={false}>
      <ComboboxInput
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={label}
        autoComplete="off"
        id={id}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (filteredSuggestions.length === 0) return;

            setActiveIndex((currentIndex) => {
              if (event.key === "ArrowDown") {
                return currentIndex < filteredSuggestions.length - 1 ? currentIndex + 1 : 0;
              }
              return currentIndex > 0 ? currentIndex - 1 : filteredSuggestions.length - 1;
            });
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            const activeSuggestion = filteredSuggestions[activeIndex];
            if (activeSuggestion) selectSuggestion(activeSuggestion);
          } else if (event.key === "Enter") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        onValueChange={(nextValue) => {
          setActiveIndex(-1);
          onValueChange(nextValue);
        }}
        value={value}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxGroup>
            {filteredSuggestions.map((suggestion, index) => (
              <ComboboxItem
                aria-selected={activeIndex === index}
                id={`${id}-option-${index}`}
                key={suggestion}
                onSelect={selectSuggestion}
                value={suggestion}
              >
                {suggestion}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { Autocomplete };
